import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as pdfParse from 'pdf-parse';
import { readFileSync, unlinkSync } from 'fs';
import axios from 'axios';
import { EmbeddingResponse } from './interfaces/embedding-response';
import { PdfDocuments } from './entities/pdf-documents.entity';
import { PdfTextChunks } from './entities/pdf-text-chunks.entity';
import { ModelResponse } from 'src/interfaces/response-model';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmbeddingService {
  private ollamaAPI: string;
  private llm = 'mxbai-embed-large';
  private model = 'llama3';
  private maxChunkSize = 1024;

  constructor(
    @InjectRepository(PdfDocuments)
    private readonly pdfDocumentsRepository: Repository<PdfDocuments>,
    @InjectRepository(PdfTextChunks)
    private readonly pdfTextChunksRepository: Repository<PdfTextChunks>,
    private readonly configService: ConfigService,
  ) {
    this.ollamaAPI = this.configService.get<string>('API_OLLAMA') || '';
  }

  async processPDF(file: Express.Multer.File) {
    try {
      const pdfBuffer = readFileSync(file.path);
      const pdfData = await pdfParse(pdfBuffer);
      unlinkSync(file.path);

      const newPdfDocument = this.pdfDocumentsRepository.create({
        filename: file.originalname,
      });

      await this.pdfDocumentsRepository.save(newPdfDocument);

      const textInChunks = this.splitTextIntoChunks(pdfData.text);

      const res = await Promise.all(
        textInChunks.map(async (chunk, index) => {
          const embedding = await this.getEmbedding(chunk);

          const newChunk = this.pdfTextChunksRepository.create({
            content: chunk,
            chunk_number: index,
            embedding,
            document: newPdfDocument,
          });
          await this.pdfTextChunksRepository.save(newChunk);
          return newChunk;
        }),
      );

      return {
        message: 'PDF processed successfully',
        documentId: newPdfDocument.id,
        chunks: res,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to process PDF: ${error.message}`,
      );
    }
  }

  async search(query: string, idDocument: string) {
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

  async chatWithContext(query: string, idDocument: string) {
    try {
      // console.log('query', query);
      console.log('idDocument', idDocument);

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
      Instrucciones: Basándote en los fragmentos de documento proporcionados, responde a la pregunta del usuario de manera clara y concisa. Si la información proporcionada no es suficiente para responder, indícalo.

      FRAGMENTOS DEL DOCUMENTO:
      ${context}

      PREGUNTA DEL USUARIO:
      ${query}

      TU RESPUESTA:`;

      const modelResponse = await this.getModelResponse(promptWithContext);

      return {
        answer: modelResponse,
        sources: relevantChunks.map((chunk) => ({
          id: chunk.id,
          chunk_number: chunk.chunk_number,
          preview:
            chunk.content.length > 150
              ? chunk.content.substring(0, 150) + '...'
              : chunk.content,
        })),
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al procesar la consulta: ${error.message}`,
      );
    }
  }

  public async getModelResponse(text: string) {
    const { data } = await axios.post<ModelResponse>(
      `${this.ollamaAPI}/api/generate`,
      {
        model: this.model,
        prompt: text,
        stream: false,
      },
    );

    return data.response;
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

  private splitTextIntoChunks(text: string): string[] {
    if (text.length <= this.maxChunkSize) {
      return [text];
    }

    const chunks: string[] = [];
    let startPos = 0;

    while (startPos < text.length) {
      let endPos = Math.min(startPos + this.maxChunkSize, text.length);

      if (endPos < text.length) {
        const newlinePos = text.lastIndexOf('\n', endPos);
        if (newlinePos > startPos && newlinePos > endPos - 100) {
          endPos = newlinePos + 1;
        } else {
          const spacePos = text.lastIndexOf(' ', endPos);
          if (spacePos > startPos && spacePos > endPos - 50) {
            endPos = spacePos + 1;
          }
        }
      }

      chunks.push(text.substring(startPos, endPos).trim());
      startPos = endPos;
    }

    return chunks;
  }
}
