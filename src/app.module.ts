import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { readFileSync } from 'fs';
import { join } from 'path';
import { EmbeddingModule } from './embedding/embedding.module';
import { MulterModule } from '@nestjs/platform-express';
import { ChatModule } from './chat/chat.module';
import { DataSource } from 'typeorm';
import { setupVectorExtension } from './embedding/utilities/setup-vector-extension';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('POSTGRES_HOST'),
        port: +configService.get('POSTGRES_PORT'),
        username: configService.get('POSTGRES_USER'),
        password: configService.get('POSTGRES_PASSWORD'),
        database: configService.get('POSTGRES_DB'),
        ssl: {
          ca: readFileSync(join(__dirname, '../pg_certs/ca.crt')).toString(),
          rejectUnauthorized: true,
        },

        autoLoadEntities: true,
        synchronize: false,
      }),
      dataSourceFactory: async (options) => {
        if (!options) {
          throw new Error('DataSource options are undefined');
        }
        const dataSource = await new DataSource(options).initialize();
        await setupVectorExtension(dataSource);
        return dataSource;
      },
    }),
    EmbeddingModule,
    ChatModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {
  constructor(private readonly configService: ConfigService) {
    const port = this.configService.get('PORT') || 3000;
    console.log(`Server running on port ${port}`);
    const api_llama = this.configService.get('API_OLLAMA') || '';
    console.log(`API OLLAMA: ${api_llama}`);
    const host = this.configService.get('POSTGRES_HOST') || '';
    console.log(`Postgres host: ${host}`);
  }
}
