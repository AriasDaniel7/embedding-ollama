import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ChatService } from './chat.service';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: Socket) {
    console.log('Client connected:', client.id);
  }

  handleDisconnect(client: Socket) {
    console.log('Client disconnected:', client.id);
  }

  @SubscribeMessage('createChat')
  async createMessage(
    @MessageBody() body: { prompt: string; idDocument: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      await this.chatService.chatWithContext(
        body.prompt,
        body.idDocument,
        this.server,
        client.id,
      );
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }
}
