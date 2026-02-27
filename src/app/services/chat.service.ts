import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject, catchError } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Interfacce allineate ai DTO del backend Spring Boot:
 * - ChatMessageResponse
 * - ConversationPreviewResponse
 */

export interface ChatMessage {
  id: number;
  senderId: number;
  senderName: string;
  receiverId: number;
  receiverName: string;
  content: string;
  status: 'SENT' | 'DELIVERED' | 'READ';
  createdAt: string;  // LocalDateTime dal backend → ISO string
}

export interface Conversation {
  otherUserId: number;
  otherUserName: string;
  otherUserRole: string;
  otherUserProfilePicture?: string; // Non presente nel DTO backend, campo opzionale
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
}

export interface SendMessageRequest {
  senderId: number;
  receiverId: number;
  content: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  private conversationsSubject = new BehaviorSubject<Conversation[]>([]);
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  messages$ = this.messagesSubject.asObservable();

  private pollingActive = false;
  private pollInterval: any;

  // ── API — allineate al ChatController backend ──────────────

  /** GET /api/chat/conversations/{userId} — lista conversazioni */
  getConversations(userId: number): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(
      `${this.apiUrl}/api/chat/conversations/${userId}`
    ).pipe(
      catchError(err => {
        console.warn('Chat API non disponibile', err);
        return of([]);
      })
    );
  }

  /** GET /api/chat/conversation/{userId1}/{userId2}?page=0&size=50 — messaggi tra due utenti */
  getMessages(userId1: number, userId2: number, page: number = 0, size: number = 50): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(
      `${this.apiUrl}/api/chat/conversation/${userId1}/${userId2}?page=${page}&size=${size}`
    ).pipe(
      catchError(err => {
        console.warn('Messaggi API non disponibile', err);
        return of([]);
      })
    );
  }

  /** POST /api/chat/send — invia messaggio */
  sendMessage(request: SendMessageRequest): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(
      `${this.apiUrl}/api/chat/send`,
      request
    );
  }

  /** PUT /api/chat/read/{receiverId}/{senderId} — segna come letti */
  markAsRead(receiverId: number, senderId: number): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/api/chat/read/${receiverId}/${senderId}`, {}
    ).pipe(catchError(() => of(null)));
  }

  // ── Polling ────────────────────────────────────────────────

  startPolling(currentUserId: number, otherUserId?: number): void {
    this.stopPolling();
    this.pollingActive = true;

    this.pollInterval = setInterval(() => {
      if (!this.pollingActive) return;

      // Aggiorna lista conversazioni solo se cambiate
      this.getConversations(currentUserId).subscribe(convs => {
        if (convs.length > 0 && !this.isEqualConversations(convs, this.conversationsSubject.value)) {
          this.conversationsSubject.next(convs);
        }
      });

      // Aggiorna messaggi solo se cambiano
      if (otherUserId) {
        this.getMessages(currentUserId, otherUserId).subscribe(msgs => {
          if (!this.isEqualMessages(msgs, this.messagesSubject.value)) {
            this.messagesSubject.next(msgs);
          }
        });
      }
    }, 4000);
  }

  stopPolling(): void {
    this.pollingActive = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  // ── Helpers ────────────────────────────────────────────────

  /** Confronta messaggi per evitare re-render inutili */
  private isEqualMessages(a: ChatMessage[], b: ChatMessage[]): boolean {
    if (a.length !== b.length) return false;
    if (a.length === 0) return true;
    // Confronta solo l'ultimo id e il count — sufficiente e veloce
    return a[a.length - 1]?.id === b[b.length - 1]?.id
        && a[0]?.id === b[0]?.id;
  }

  /** Confronta conversazioni per evitare re-render inutili */
  private isEqualConversations(a: Conversation[], b: Conversation[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i].otherUserId !== b[i].otherUserId
        || a[i].unreadCount !== b[i].unreadCount
        || a[i].lastMessage !== b[i].lastMessage
        || a[i].lastMessageTime !== b[i].lastMessageTime) {
        return false;
      }
    }
    return true;
  }

  refreshConversations(userId: number): void {
    this.getConversations(userId).subscribe(convs => {
      this.conversationsSubject.next(convs);
    });
  }

  clearMessages(): void {
    this.messagesSubject.next([]);
  }
}
