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

  // ── Subjects e Observables ─────────────────────────────────
  private conversationsSubject = new BehaviorSubject<Conversation[]>([]);
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  private unreadCountSubject = new BehaviorSubject<number>(0);

  conversations$ = this.conversationsSubject.asObservable();
  messages$ = this.messagesSubject.asObservable();
  unreadCount$ = this.unreadCountSubject.asObservable();

  // ── Polling messaggi (solo dentro una conversazione attiva) ──
  private msgPollingActive = false;
  private msgPollInterval: any;

  // ── Polling globale notifiche (gira SEMPRE) ────────────────
  private globalPollInterval: any;
  private globalPollingActive = false;

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

  /** GET /api/chat/unread/{userId} — conteggio totale non letti */
  getUnreadCount(userId: number): Observable<number> {
    return this.http.get<number>(
      `${this.apiUrl}/api/chat/unread/${userId}`
    ).pipe(catchError(() => of(0)));
  }

  // ── Polling globale (notifiche) — gira SEMPRE ──────────────

  startGlobalPolling(userId: number): void {
    if (this.globalPollingActive) return;
    this.globalPollingActive = true;

    // Carica subito
    this.refreshUnreadCount(userId);
    this.refreshConversations(userId);

    this.globalPollInterval = setInterval(() => {
      if (!this.globalPollingActive) return;
      this.refreshUnreadCount(userId);
      this.refreshConversations(userId);
    }, 5000);
  }

  stopGlobalPolling(): void {
    this.globalPollingActive = false;
    if (this.globalPollInterval) {
      clearInterval(this.globalPollInterval);
      this.globalPollInterval = null;
    }
  }

  private refreshUnreadCount(userId: number): void {
    this.getUnreadCount(userId).subscribe(count => {
      if (count !== this.unreadCountSubject.value) {
        this.unreadCountSubject.next(count);
      }
    });
  }

  private refreshConversations(userId: number): void {
    this.getConversations(userId).subscribe(convs => {
      if (convs.length > 0) {
        this.conversationsSubject.next(convs);
      }
    });
  }

  // ── Polling messaggi (dentro una conversazione) ────────────

  startMessagePolling(currentUserId: number, otherUserId: number): void {
    this.stopMessagePolling();
    this.msgPollingActive = true;

    this.msgPollInterval = setInterval(() => {
      if (!this.msgPollingActive) return;
      this.getMessages(currentUserId, otherUserId).subscribe(msgs => {
        if (msgs.length > 0) {
          this.messagesSubject.next(msgs);
        }
      });
    }, 3000);
  }

  stopMessagePolling(): void {
    this.msgPollingActive = false;
    if (this.msgPollInterval) {
      clearInterval(this.msgPollInterval);
      this.msgPollInterval = null;
    }
  }

  // ── Helpers ────────────────────────────────────────────────

  clearMessages(): void {
    this.messagesSubject.next([]);
  }

  getConversationsSnapshot(): Conversation[] {
    return this.conversationsSubject.value;
  }
}

