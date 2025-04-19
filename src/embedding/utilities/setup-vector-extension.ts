import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export async function setupVectorExtension(dataSource: DataSource) {
  try {
    // Crear la extensión vector si no existe
    await dataSource.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    Logger.log('Vector extension enabled', 'PostgreSQL');

    // Convertir columna embedding a tipo vector
    await dataSource.query(`
    DO $$
    BEGIN
      -- Verificar si la columna ya es de tipo vector
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'pdf_text_chunks'
        AND column_name = 'embedding'
        AND data_type = 'jsonb'
      ) THEN
        -- Convertir la columna de jsonb a vector
        ALTER TABLE pdf_text_chunks 
        ALTER COLUMN embedding TYPE vector(1024) 
        USING embedding::text::vector(1024);
      END IF;
    END
    $$;
    `);

    Logger.log('Vector column conversion completed', 'PostgreSQL');
  } catch (error) {
    Logger.error(
      `Failed to setup vector extension: ${error.message}`,
      'PostgreSQL',
    );
    throw error;
  }
}
