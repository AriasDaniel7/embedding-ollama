import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PdfDocuments } from './pdf-documents.entity';

@Entity('pdf_text_chunks')
export class PdfTextChunks {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('integer')
  chunk_number: number;

  @Column('text')
  content: string;

  @Column({ type: 'jsonb', array: true })
  embedding: number[];

  @ManyToOne(() => PdfDocuments, (document) => document.textChunks, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'document_id' })
  document: PdfDocuments;
}
