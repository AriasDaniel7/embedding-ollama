-- Active: 1744572712451@@localhost@5432@embedded
-- Asegurarse de que las extensiones necesarias estén habilitadas
CREATE EXTENSION IF NOT EXISTS vector;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla para documentos PDF
CREATE TABLE pdf_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (), -- ID único para cada documento
    filename TEXT NOT NULL -- Nombre del archivo del documento
);

-- Tabla para los fragmentos de texto de los documentos PDF
CREATE TABLE pdf_text_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (), -- ID único para cada fragmento
    document_id UUID REFERENCES pdf_documents (id) ON DELETE CASCADE, -- Relación con pdf_documents
    chunk_number INTEGER NOT NULL, -- Número de fragmento
    content TEXT, -- Texto del fragmento
    embedding vector (1024) -- Vector de embeddings (tamaño ajustable al modelo)
);