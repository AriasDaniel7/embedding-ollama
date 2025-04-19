import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('embedding')
export class EmbeddingController {
  constructor(private readonly embeddingService: EmbeddingService) {}

  @Post('pdf')
  @UseInterceptors(FileInterceptor('file'))
  uploadPdf(@UploadedFile() file: Express.Multer.File) {
    return this.embeddingService.processPDF(file);
  }

  @Post('search')
  search(@Body() body: { search: string; idDocument: string }) {
    return this.embeddingService.search(body.search, body.idDocument);
  }

  @Post('chat')
  chat(@Body() body: { query: string; idDocument: string }) {
    return this.embeddingService.chatWithContext(body.query, body.idDocument);
  }
}
