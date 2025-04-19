import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { PdfTextChunks } from './pdf-text-chunks.entity';

@Entity('pdf_documents')
export class PdfDocuments {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  filename: string;

  @OneToMany(() => PdfTextChunks, (chunk) => chunk.document, { cascade: true })
  textChunks: PdfTextChunks[];
}
