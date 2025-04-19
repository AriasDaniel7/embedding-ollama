import { computed, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';

export type WebSocketStatus =
  | 'connecting'
  | 'open'
  | 'closing'
  | 'closed'
  | 'error';

@Injectable({
  providedIn: 'root',
})
export class WebSocketService {
  private socket: Socket;

  private statusSignal = signal<WebSocketStatus>('closed');

  public isConnected = computed(() => this.statusSignal() === 'open');

  constructor() {
    this.socket = io('http://localhost:3000');

    this.socket.on('connect', () => {
      this.statusSignal.set('open');
      console.log('Connected to WebSocket server');
    });
  }

  emit(event: string, data: any) {
    this.socket.emit(event, data);
  }

  on(event: string) {
    return new Observable((observer) => {
      this.socket.on(event, (data) => {
        observer.next(data);
      });

      return () => {
        this.socket.off(event);
      };
    });
  }
}
