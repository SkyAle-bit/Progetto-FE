import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject, Subject, catchError } from 'rxjs';
import { environment } from '../../environments/environment';
import { SocketService, WsIncomingMessage } from './socket.service';

// ── Interfacce DTO ──────────────────────────────────────────

export interface ChatMessage {
  id: number;
  chatId: number;
  senderId: number;
  senderName: string;
  receiverId: number;
  receiverName: string;
  content: string;
  status: 'SENT' | 'DELIVERED' | 'READ';
  createdAt: string;
}

export interface Conversation {
  chatId?: number;
  otherUserId: number;
  otherUserName: string;
  otherUserRole: string;
  otherUserProfilePicture?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  terminated?: boolean;
}

export interface SendMessageRequest {
  senderId: number;
  chatId: number;
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

  getMessages(chatId: number, userId: number, page = 0, size = 50): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(
      `${this.apiUrl}/api/chat/conversation/${chatId}/${userId}?page=${page}&size=${size}`
    ).pipe(catchError(() => of([])));
  }

  sendMessage(request: SendMessageRequest): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(`${this.apiUrl}/api/chat/send`, request);
  }

  createChat(senderId: number, receiverId: number): Observable<number> {
    return this.http.post<number>(`${this.apiUrl}/api/chat/create/${senderId}/${receiverId}`, {});
  }

  markAsRead(chatId: number, userId: number, otherUserId: number): Observable<any> {
    this.optimisticMarkAsRead(otherUserId);
    return this.http.put(
      `${this.apiUrl}/api/chat/read/${chatId}/${userId}`, {}
    ).pipe(catchError(() => of(null)));
  }

  getUnreadCount(userId: number): Observable<number> {
    return this.http.get<number>(
      `${this.apiUrl}/api/chat/unread/${userId}`
    ).pipe(catchError(() => of(0)));
  }

  terminateChat(chatId: number, userId: number): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/api/chat/terminate/${chatId}/${userId}`, {}
    ).pipe(catchError(() => of(null)));
  }

  // ══════════════════════════════════════════════════════════════
  //  INIZIALIZZAZIONE REAL-TIME
  // ══════════════════════════════════════════════════════════════

  /** Bootstrap real-time chat: WebSocket + event subscriptions + global polling fallback. */
  init(userId: number): void {
    this.destroy(); // CLEANUP prevent duplicate listeners and memory leaks


    this.socketService.connect(userId);


    const msgSub = this.socketService.incomingMessage$.subscribe(wsMsg => {
      this.handleIncomingWsMessage(wsMsg, userId);
    });
    this.wsSubscriptions.push(msgSub);


    const unreadSub = this.socketService.unreadUpdate$.subscribe(update => {
      if (update.userId === userId) {
        this.unreadCountSubject.next(update.unreadCount);
      }
    });
    this.wsSubscriptions.push(unreadSub);


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

  joinRoom(chatId: number): void {
    this.socketService.joinRoom(chatId);
  }

  leaveRoom(): void {
    this.socketService.leaveRoom();
  }

  /**
   * Invia messaggio via WebSocket (real-time).
   * Ritorna il messaggio locale per UI ottimistica.
   */
  sendMessageRealTime(chatId: number, senderId: number, content: string, senderName: string, receiverName: string, receiverId: number): ChatMessage {
    const localMsg: ChatMessage = {
      id: -Date.now(),
      chatId,
      senderId,
      senderName,
      receiverId,
      receiverName,
      content,
      status: 'SENT',
      createdAt: new Date().toISOString()
    };
    this.socketService.sendMessage(chatId, senderId, content);
    return localMsg;
  }

  markAsReadRealTime(chatId: number, otherUserId: number): void {
    this.socketService.markAsRead(chatId);
    this.optimisticMarkAsRead(otherUserId);
  }

  private optimisticMarkAsRead(otherUserId: number): void {
    const convs = this.conversationsSubject.value;
    const idx = convs.findIndex(c => c.otherUserId === otherUserId);
    if (idx >= 0 && convs[idx].unreadCount > 0) {
      const readMessages = convs[idx].unreadCount;


      const updated = [...convs];
      updated[idx] = { ...updated[idx], unreadCount: 0 };
      this.conversationsSubject.next(updated);


      const currentGlobal = this.unreadCountSubject.value;
      if (currentGlobal >= readMessages) {
        this.unreadCountSubject.next(currentGlobal - readMessages);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  HANDLER MESSAGGI IN ARRIVO
  // ══════════════════════════════════════════════════════════════

  private handleIncomingWsMessage(wsMsg: WsIncomingMessage, currentUserId: number): void {
    const msg: ChatMessage = {
      id: wsMsg.id,
      chatId: wsMsg.chatId,
      senderId: wsMsg.senderId,
      senderName: wsMsg.senderName,
      receiverId: wsMsg.receiverId,
      receiverName: wsMsg.receiverName,
      content: wsMsg.content,
      status: wsMsg.status,
      createdAt: wsMsg.createdAt
    };

    const currentRoom = this.socketService.currentRoomId;
    const msgRoom = wsMsg.roomId;

    if (currentRoom === msgRoom) {
      const currentMsgs = this.messagesSubject.value;

      // Cerca se esiste un messaggio locale ottimistico (id < 0) con stessa content e sender
      const localOptimisticIdx = currentMsgs.findIndex(m =>
        m.id < 0 && m.senderId === msg.senderId && m.content === msg.content
      );

      // Cerca se esiste già con lo stesso id positivo dal server
      const serverDuplicateIdx = currentMsgs.findIndex(m => m.id > 0 && m.id === msg.id);

      if (localOptimisticIdx >= 0) {

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
    const otherUserName = wsMsg.senderId === currentUserId ? wsMsg.receiverName : wsMsg.senderName;
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
    } else {

      const newConv: Conversation = {
        chatId: wsMsg.chatId,
        otherUserId,
        otherUserName: otherUserName || 'Utente',
        otherUserRole: '',
        lastMessage: wsMsg.content,
        lastMessageTime: wsMsg.createdAt,
        unreadCount: wsMsg.senderId !== currentUserId ? 1 : 0
      };
      this.conversationsSubject.next([newConv, ...convs]);
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
      let currentConvs = convs ?? [];

      // Preserve active conversation not yet persisted on backend
      if (this._activeConversation) {
        const activeId = this._activeConversation.otherUserId;

        // Optimistic unread reset for the active conversation
        const activeConv = currentConvs.find(c => c.otherUserId === activeId);
        if (activeConv) {
          activeConv.unreadCount = 0;
        }

        if (!currentConvs.some(c => c.otherUserId === activeId)) {

          const existingLocal = this.conversationsSubject.value.find(c => c.otherUserId === activeId);
          if (existingLocal) {
            currentConvs = [existingLocal, ...currentConvs];
          } else {
            currentConvs = [this._activeConversation, ...currentConvs];
          }
        }
      }

      this.conversationsSubject.next(currentConvs);
    });
  }

  // ── Polling messaggi (fallback per quando WS non è connesso) ──

  startMessagePolling(chatId: number, currentUserId: number): void {
    if (this.socketService.isConnected) return;
    this.stopMessagePolling();
    this.msgPollingActive = true;
    this.msgPollInterval = setInterval(() => {
      if (!this.msgPollingActive) return;
      this.getMessages(chatId, currentUserId).subscribe(msgs => {
        if (msgs.length > 0) {

          const currentMsgs = this.messagesSubject.value;
          const localOptimistic = currentMsgs.filter(m => m.id < 0);
          const serverIds = new Set(msgs.map(m => m.id));


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

  setMessages(msgs: ChatMessage[]): void {
    this.messagesSubject.next(msgs);
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
