import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject, Subject, catchError } from 'rxjs';
import { environment } from '../../environments/environment';
import { SocketService, WsIncomingMessage } from './socket.service';

// ── Interfacce DTO ──────────────────────────────────────────

export interface ChatMessage {
  id: number;
  senderId: number;
  senderName: string;
  receiverId: number;
  receiverName: string;
  content: string;
  status: 'SENT' | 'DELIVERED' | 'READ';
  createdAt: string;
}

export interface Conversation {
  otherUserId: number;
  otherUserName: string;
  otherUserRole: string;
  otherUserProfilePicture?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
}

export interface SendMessageRequest {
  senderId: number;
  receiverId: number;
  content: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private http = inject(HttpClient);
  private socketService = inject(SocketService);
  private apiUrl = environment.apiUrl;

  // ── State ──────────────────────────────────────────────────
  private conversationsSubject = new BehaviorSubject<Conversation[]>([]);
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  private unreadCountSubject = new BehaviorSubject<number>(0);

  /** Conversazione attiva — persiste anche quando il componente chat viene distrutto */
  private _activeConversation: Conversation | null = null;

  conversations$ = this.conversationsSubject.asObservable();
  messages$ = this.messagesSubject.asObservable();
  unreadCount$ = this.unreadCountSubject.asObservable();

  /** Emesso quando arriva un nuovo messaggio real-time */
  private newMessageSubject = new Subject<ChatMessage>();
  newMessage$ = this.newMessageSubject.asObservable();

  // ── Polling fallback ───────────────────────────────────────
  private msgPollingActive = false;
  private msgPollInterval: any;
  private globalPollInterval: any;
  private globalPollingActive = false;

  // ── WebSocket subscription tracking ────────────────────────
  private wsSubscriptions: any[] = [];

  // ══════════════════════════════════════════════════════════════
  //  API REST (caricamento iniziale e fallback)
  // ══════════════════════════════════════════════════════════════

  getConversations(userId: number): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(
      `${this.apiUrl}/api/chat/conversations/${userId}`
    ).pipe(catchError(() => of([])));
  }

  getMessages(userId1: number, userId2: number, page = 0, size = 50): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(
      `${this.apiUrl}/api/chat/conversation/${userId1}/${userId2}?page=${page}&size=${size}`
    ).pipe(catchError(() => of([])));
  }

  sendMessage(request: SendMessageRequest): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(`${this.apiUrl}/api/chat/send`, request);
  }

  markAsRead(receiverId: number, senderId: number): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/api/chat/read/${receiverId}/${senderId}`, {}
    ).pipe(catchError(() => of(null)));
  }

  getUnreadCount(userId: number): Observable<number> {
    return this.http.get<number>(
      `${this.apiUrl}/api/chat/unread/${userId}`
    ).pipe(catchError(() => of(0)));
  }

  // ══════════════════════════════════════════════════════════════
  //  INIZIALIZZAZIONE REAL-TIME
  // ══════════════════════════════════════════════════════════════

  /**
   * Inizializza la chat real-time:
   * 1) Connette il WebSocket
   * 2) Sottoscrive agli eventi in arrivo
   * 3) Avvia polling globale come fallback
   */
  init(userId: number): void {
    // Connetti WebSocket
    this.socketService.connect(userId);

    // Sottoscrivi ai messaggi in arrivo dal WebSocket
    const msgSub = this.socketService.incomingMessage$.subscribe(wsMsg => {
      this.handleIncomingWsMessage(wsMsg, userId);
    });
    this.wsSubscriptions.push(msgSub);

    // Sottoscrivi agli aggiornamenti unread dal WebSocket
    const unreadSub = this.socketService.unreadUpdate$.subscribe(update => {
      if (update.userId === userId) {
        this.unreadCountSubject.next(update.unreadCount);
      }
    });
    this.wsSubscriptions.push(unreadSub);

    // Avvia polling globale leggero come fallback
    this.startGlobalPolling(userId);
  }

  /**
   * Cleanup completo — chiamare al logout/destroy
   */
  destroy(): void {
    this.wsSubscriptions.forEach(s => s.unsubscribe());
    this.wsSubscriptions = [];
    this.socketService.disconnect();
    this.stopGlobalPolling();
    this.stopMessagePolling();
  }

  // ══════════════════════════════════════════════════════════════
  //  GESTIONE STANZE
  // ══════════════════════════════════════════════════════════════

  joinRoom(otherUserId: number): void {
    this.socketService.joinRoom(otherUserId);
  }

  leaveRoom(): void {
    this.socketService.leaveRoom();
  }

  /**
   * Invia messaggio via WebSocket (real-time).
   * Ritorna il messaggio locale per UI ottimistica.
   */
  sendMessageRealTime(senderId: number, receiverId: number, content: string, senderName: string, receiverName: string): ChatMessage {
    const localMsg: ChatMessage = {
      id: -Date.now(),
      senderId,
      senderName,
      receiverId,
      receiverName,
      content,
      status: 'SENT',
      createdAt: new Date().toISOString()
    };
    this.socketService.sendMessage(senderId, receiverId, content);
    return localMsg;
  }

  markAsReadRealTime(otherUserId: number): void {
    this.socketService.markAsRead(otherUserId);
  }

  // ══════════════════════════════════════════════════════════════
  //  HANDLER MESSAGGI IN ARRIVO
  // ══════════════════════════════════════════════════════════════

  private handleIncomingWsMessage(wsMsg: WsIncomingMessage, currentUserId: number): void {
    const msg: ChatMessage = {
      id: wsMsg.id,
      senderId: wsMsg.senderId,
      senderName: wsMsg.senderName,
      receiverId: wsMsg.receiverId,
      receiverName: wsMsg.receiverName,
      content: wsMsg.content,
      status: wsMsg.status,
      createdAt: wsMsg.createdAt
    };

    const currentRoom = this.socketService.currentRoomId;
    const msgRoom = wsMsg.roomId || this.socketService.getRoomId(wsMsg.senderId, wsMsg.receiverId);

    if (currentRoom === msgRoom) {
      const currentMsgs = this.messagesSubject.value;

      // Cerca se esiste un messaggio locale ottimistico (id < 0) con stessa content e sender
      const localOptimisticIdx = currentMsgs.findIndex(m =>
        m.id < 0 && m.senderId === msg.senderId && m.content === msg.content
      );

      // Cerca se esiste già con lo stesso id positivo dal server
      const serverDuplicateIdx = currentMsgs.findIndex(m => m.id > 0 && m.id === msg.id);

      if (localOptimisticIdx >= 0) {
        // Sostituisci il messaggio locale ottimistico con quello dal server
        const updated = [...currentMsgs];
        updated[localOptimisticIdx] = msg;
        this.messagesSubject.next(updated);
      } else if (serverDuplicateIdx >= 0) {
        // Messaggio duplicato dal server — ignora
      } else {
        // Messaggio nuovo
        this.messagesSubject.next([...currentMsgs, msg]);
      }
    }

    this.newMessageSubject.next(msg);
    this.updateConversationPreview(wsMsg, currentUserId);
  }

  private updateConversationPreview(wsMsg: WsIncomingMessage, currentUserId: number): void {
    const convs = this.conversationsSubject.value;
    const otherUserId = wsMsg.senderId === currentUserId ? wsMsg.receiverId : wsMsg.senderId;
    const idx = convs.findIndex(c => c.otherUserId === otherUserId);
    if (idx >= 0) {
      const updated = [...convs];
      updated[idx] = {
        ...updated[idx],
        lastMessage: wsMsg.content,
        lastMessageTime: wsMsg.createdAt,
        unreadCount: (wsMsg.senderId !== currentUserId && this.socketService.currentRoomId !== wsMsg.roomId)
          ? updated[idx].unreadCount + 1
          : updated[idx].unreadCount
      };
      this.conversationsSubject.next(updated);
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  POLLING GLOBALE (fallback + sync periodico)
  // ══════════════════════════════════════════════════════════════

  startGlobalPolling(userId: number): void {
    if (this.globalPollingActive) return;
    this.globalPollingActive = true;

    this.refreshUnreadCount(userId);
    this.refreshConversations(userId);

    // Polling più lento quando WS è connesso, più veloce se WS è down
    const getInterval = () => this.socketService.isConnected ? 15000 : 5000;
    this.globalPollInterval = setInterval(() => {
      if (!this.globalPollingActive) return;
      this.refreshUnreadCount(userId);
      this.refreshConversations(userId);
    }, getInterval());
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

  // ── Polling messaggi (fallback per quando WS non è connesso) ──

  startMessagePolling(currentUserId: number, otherUserId: number): void {
    if (this.socketService.isConnected) return;
    this.stopMessagePolling();
    this.msgPollingActive = true;
    this.msgPollInterval = setInterval(() => {
      if (!this.msgPollingActive) return;
      this.getMessages(currentUserId, otherUserId).subscribe(msgs => {
        if (msgs.length > 0) {
          // Merge: mantieni i messaggi locali ottimistici (id < 0) non ancora confermati
          const currentMsgs = this.messagesSubject.value;
          const localOptimistic = currentMsgs.filter(m => m.id < 0);
          const serverIds = new Set(msgs.map(m => m.id));

          // Filtra i locali ottimistici che non hanno ancora un corrispondente dal server
          const unresolvedLocal = localOptimistic.filter(local =>
            !msgs.some(server => server.senderId === local.senderId && server.content === local.content)
          );

          this.messagesSubject.next([...msgs, ...unresolvedLocal]);
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

  getMessagesSnapshot(): ChatMessage[] {
    return this.messagesSubject.value;
  }

  get activeConversation(): Conversation | null {
    return this._activeConversation;
  }

  set activeConversation(conv: Conversation | null) {
    this._activeConversation = conv;
  }
}
