FROM postgres:17.4

# Instalar dependencias necesarias
RUN apt-get update && apt-get install -y \
    openssl \
    && apt-get install -y postgresql-server-dev-17 \
    git \
    make \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/pgvector/pgvector.git /pgvector && \
    cd /pgvector && \
    make && make install

RUN rm -rf /pgvector

# Crear directorio para certificados SSL
RUN mkdir -p /var/lib/postgresql/ssl

# Generar CA y certificados firmados por el CA
RUN cd /var/lib/postgresql/ssl && \
    # Generar clave privada para CA
    openssl genrsa -out ca.key 4096 && \
    chmod 600 ca.key && \
    # Generar certificado CA autofirmado
    openssl req -new -x509 -key ca.key -out ca.crt -days 3650 -subj "/CN=postgres-ca" && \
    # Generar clave privada del servidor
    openssl genrsa -out server.key 2048 && \
    chmod 600 server.key && \
    # Generar extensiones para el certificado del servidor
    echo "subjectAltName=DNS:postgresql,DNS:localhost,IP:127.0.0.1" > extensions.cnf && \
    # Generar CSR (Certificate Signing Request)
    openssl req -new -key server.key -out server.csr -subj "/CN=localhost" && \
    # Generar certificado del servidor firmado por el CA con extensiones personalizadas
    openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 365 -extfile extensions.cnf && \
    # Establecer permisos correctos
    chown -R postgres:postgres /var/lib/postgresql/ssl && \
    # Crear directorio compartido para certificados
    mkdir -p /certs && \
    # Copiar certificado CA al directorio compartido
    cp /var/lib/postgresql/ssl/ca.crt /certs/ && \
    chmod 644 /certs/ca.crt

# Copiar archivo de configuración personalizado
COPY postgresql.conf /etc/postgresql/postgresql.conf
COPY pg_hba.conf /etc/postgresql/pg_hba.conf

# Configurar variables de entorno para SSL
ENV POSTGRES_INITDB_ARGS="--data-checksums"
ENV POSTGRES_HOST_AUTH_METHOD="scram-sha-256"
ENV PGDATA=/var/lib/postgresql/data

# Comando para iniciar PostgreSQL con la configuración personalizada
CMD ["postgres", "-c", "config_file=/etc/postgresql/postgresql.conf", "-c", "hba_file=/etc/postgresql/pg_hba.conf"]