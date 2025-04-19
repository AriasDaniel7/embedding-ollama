# Embedding con PostgreSQL + PgVector + Ollama

## Instalaciones necesarias

1. Instalar dependencias del proyecto:

   ```
   npm install
   ```

2. Construir y levantar los contenedores con Docker:

   ```
   docker-compose up --build -d
   ```

3. Ejecutar el script SQL para crear las tablas:

   - Abrir el archivo `sql/query.sql`.
   - Ejecutar el script en el contenedor de PostgreSQL o en tu cliente SQL preferido.

4. Verificar que las tablas se hayan creado correctamente:

   ```
   docker exec -it postgres psql -U postgres -d tu_base_de_datos -c "\dt"
   ```

## Uso

1. Entrar al contenedor de Ollama:

   ```
   docker exec -it ollama bash
   ```

2. Ejecutar el modelo de agente:

   ```
   ollama run llama3
   ```

3. Descargar el modelo de embedding:

   ```
   ollama pull mxbai-embed-large
   ```
