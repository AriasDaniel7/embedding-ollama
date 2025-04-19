import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { EmbeddingModule } from 'src/embedding/embedding.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule, EmbeddingModule],
  providers: [ChatGateway, ChatService],
})
export class ChatModule {}
