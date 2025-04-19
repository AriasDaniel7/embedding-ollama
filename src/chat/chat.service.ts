import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { Server } from 'socket.io';
import { PdfDocuments } from 'src/embedding/entities/pdf-documents.entity';
import { PdfTextChunks } from 'src/embedding/entities/pdf-text-chunks.entity';
import { EmbeddingResponse } from 'src/embedding/interfaces/embedding-response';
import { Readable } from 'stream';
import { Repository } from 'typeorm';

@Injectable()
export class ChatService {
  private ollamaAPI: string;
  private llm = 'mxbai-embed-large';
  private model = 'llama3';

  constructor(
    @InjectRepository(PdfDocuments)
    private readonly pdfDocumentsRepository: Repository<PdfDocuments>,
    @InjectRepository(PdfTextChunks)
    private readonly pdfTextChunksRepository: Repository<PdfTextChunks>,
    private readonly configService: ConfigService,
  ) {
    this.ollamaAPI = this.configService.get<string>('API_OLLAMA') || '';
  }

  async chatWithContext(
    query: string,
    idDocument: string,
    server: Server,
    clientId: string,
  ) {
    try {
      const document = await this.pdfDocumentsRepository.findOne({
        where: { id: idDocument },
      });

      if (!document) {
        throw new NotFoundException(`Document with ID ${idDocument} not found`);
      }

      const relevantChunks = await this.search(query, idDocument);

      if (!relevantChunks || relevantChunks.length === 0) {
        return {
          answer:
            'No encontré información relevante para responder a tu pregunta en este documento.',
          sources: [],
        };
      }

      const context = relevantChunks.map((chunk) => chunk.content).join('\n\n');
      // console.log('context', context);

      const promptWithContext = `
      Eres un profesor experto que responde preguntas con autoridad y claridad.

      Utiliza la siguiente información como referencia para responder a la pregunta, pero no menciones estos fragmentos ni que estás basando tu respuesta en ellos.
      
      Información de referencia:
      ${context}

      Pregunta: ${query}
      
      Responde de manera directa, clara y profesional, como lo haría un experto en la materia. Si la información proporcionada no es suficiente, admite las limitaciones de tu conocimiento pero ofrece la mejor respuesta posible.`;

      await this.getModelResponse(promptWithContext, server, clientId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al procesar la consulta: ${error.message}`,
      );
    }
  }

  private async getModelResponse(
    text: string,
    server: Server,
    clientId: string,
  ) {
    try {
      const { data } = await axios.post<Readable>(
        `${this.ollamaAPI}/api/generate`,
        {
          model: this.model,
          prompt: text,
          stream: true,
        },
        {
          responseType: 'stream',
        },
      );

      let buffer = '';
      let lastEmitTime = Date.now();
      const EMIT_INTERVAL = 50; // milliseconds

      data.on('data', (chunk: Buffer) => {
        try {
          const chunkData = JSON.parse(chunk.toString());
          if (chunkData.response) {
            buffer += chunkData.response;
            const currentTime = Date.now();
            if (currentTime - lastEmitTime >= EMIT_INTERVAL) {
              server.to(clientId).emit('message', buffer);
              lastEmitTime = currentTime;
            }
          }
        } catch (error) {
          console.error('Error parsing chunk:', error);
        }
      });

      data.on('end', () => {
        server.to(clientId).emit('message', buffer.trim());
      });

      data.on('error', (error) => {
        console.error('Stream error:', error);
        server
          .to(clientId)
          .emit('error', { message: 'Error in stream response' });
      });
    } catch (error) {
      console.error('Request error:', error);
      server
        .to(clientId)
        .emit('error', { message: 'Failed to generate response' });
    }
  }

  private async search(query: string, idDocument: string) {
    const document = await this.pdfDocumentsRepository.findOne({
      where: { id: idDocument },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID ${idDocument} not found`);
    }
    try {
      const queryEmbedding = await this.getEmbedding(query);
      const chunks = await this.pdfTextChunksRepository.query(
        `
          SELECT 
            id, 
            chunk_number, 
            content,
            1 - (embedding <=> $2) AS similarity_score
          FROM pdf_text_chunks
          WHERE document_id = $1
          AND 1 - (embedding <=> $2) > 0.75  -- Umbral de similitud (ajustable)
          ORDER BY similarity_score DESC
          LIMIT 5
          `,
        [idDocument, JSON.stringify(queryEmbedding)],
      );

      if (chunks.length === 0) {
        // Búsqueda de respaldo con umbral más bajo
        const backupChunks = await this.pdfTextChunksRepository.query(
          `
            SELECT 
              id, 
              chunk_number, 
              content,
              1 - (embedding <=> $2) AS similarity_score
            FROM pdf_text_chunks
            WHERE document_id = $1
            ORDER BY embedding <=> $2
            LIMIT 3
            `,
          [idDocument, JSON.stringify(queryEmbedding)],
        );
        return backupChunks;
      }

      return chunks;
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to search: ${error.message}`,
      );
    }
  }

  private async getEmbedding(text: string) {
    const { data } = await axios.post<EmbeddingResponse>(
      `${this.ollamaAPI}/api/embed`,
      {
        model: this.llm,
        input: text,
      },
    );

    return data.embeddings[0];
  }
}
