import { Component, OnInit, OnDestroy, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { WebSocketService } from './services/webSocket.service';
import { NgClass, NgFor, NgIf } from '@angular/common';

interface Message {
  from: 'user' | 'bot';
  content: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgIf, NgFor, NgClass],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, OnDestroy {
  private wsService = inject(WebSocketService);
  private http = inject(HttpClient);

  protected isConnected = this.wsService.isConnected;
  protected isLoading = signal<boolean>(false);
  protected selectedFile: File | null = null;
  protected uploading = signal(false);
  protected uploadSuccess = signal(false);
  protected uploadError = signal('');
  protected currentIdDocument = signal<string | null>(null);
  protected showPdfRequiredError = signal(false);
  protected messages = signal<Message[]>([]);

  private responseTypingTimeout: any = null;

  // ✅ Referencia al contenedor scrollable
  @ViewChild('scrollContainer') scrollContainer!: ElementRef;

  constructor() {
    console.log('🚀 AppComponent cargado');
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    if (this.responseTypingTimeout) clearTimeout(this.responseTypingTimeout);
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.scrollContainer) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      }
    }, 50); // pequeño delay para que el DOM se actualice
  }

  onFileSelected(event: any): void {
    this.selectedFile = event.target.files[0];
    this.currentIdDocument.set(null);
    this.uploadSuccess.set(false);
    this.uploadError.set('');
    this.showPdfRequiredError.set(false);
    console.log('📎 Archivo seleccionado:', this.selectedFile);
  }

  sendMessage(): void {
    if (this.isLoading()) return;

    const input = document.getElementById('messageInput') as HTMLTextAreaElement;
    const prompt = input.value.trim();
    input.value = '';

    if (!this.currentIdDocument() && !this.selectedFile) {
      this.showPdfRequiredError.set(true);
      return;
    }

    if (!this.currentIdDocument() && this.selectedFile) {
      this.uploadPdf(() => {
        this.showPdfRequiredError.set(false);
        if (prompt) this.finalizeMessageSend(prompt);
      });
    } else {
      this.showPdfRequiredError.set(false);
      if (prompt) this.finalizeMessageSend(prompt);
    }
  }

  private finalizeMessageSend(prompt: string): void {
    this.isLoading.set(true);
    this.messages.update((msgs) => [...msgs, { from: 'user', content: prompt }]);
    this.messages.update((msgs) => [...msgs, { from: 'bot', content: '' }]);
    this.scrollToBottom(); // después de enviar

    const body = {
      prompt: prompt,
      idDocument: this.currentIdDocument(),
    };

    this.wsService.emit('createChat', body);

    this.wsService.on('message').subscribe((data: unknown) => {
      const responseText = data?.toString?.() || '';

      this.messages.update((msgs) => {
        const updated = [...msgs];
        const lastBotMessageIndex = updated.findIndex(
          (msg, i) => msg.from === 'bot' && i === updated.length - 1
        );

        if (lastBotMessageIndex !== -1) {
          updated[lastBotMessageIndex] = {
            ...updated[lastBotMessageIndex],
            content: responseText,
          };
        }

        return updated;
      });

      this.scrollToBottom(); // mientras escribe

      if (this.responseTypingTimeout) clearTimeout(this.responseTypingTimeout);

      this.responseTypingTimeout = setTimeout(() => {
        this.isLoading.set(false);
        this.scrollToBottom(); // al finalizar
      }, 1000);
    });
  }

  uploadPdf(callback?: () => void): void {
    if (this.selectedFile) {
      this.uploading.set(true);
      this.uploadSuccess.set(false);
      this.uploadError.set('');

      const formData = new FormData();
      formData.append('file', this.selectedFile, this.selectedFile.name);

      this.http
        .post<{ message: string; documentId: string }>(
          'http://localhost:3000/api/embedding/pdf',
          formData
        )
        .subscribe({
          next: (response) => {
            this.uploading.set(false);
            this.uploadSuccess.set(true);
            this.currentIdDocument.set(response.documentId);
            if (callback) callback();
          },
          error: (error) => {
            this.uploading.set(false);
            this.uploadError.set('Error al subir el PDF.');
            console.error('Error al subir el PDF:', error);
          },
        });
    }
  }
}
