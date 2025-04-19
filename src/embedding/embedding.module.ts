import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';

import { EmbeddingService } from './embedding.service';
import { EmbeddingController } from './embedding.controller';
import { PdfDocuments } from './entities/pdf-documents.entity';
import { PdfTextChunks } from './entities/pdf-text-chunks.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([PdfDocuments, PdfTextChunks]),
    MulterModule.register({
      dest: './uploads',
    }),
  ],
  controllers: [EmbeddingController],
  providers: [EmbeddingService],
  exports: [TypeOrmModule],
})
export class EmbeddingModule {}
