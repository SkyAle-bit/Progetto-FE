import { Injectable, inject, NgZone } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Payload in arrivo dal backend via WebSocket.
 * Corrisponde a ChatMessageResponse del backend Spring Boot.
 */
export interface WsIncomingMessage {
  id: number;
  senderId: number;
  senderName: string;
  receiverId: number;
  receiverName: string;
  content: string;
  status: 'SENT' | 'DELIVERED' | 'READ';
  createdAt: string;
  roomId: string;
}

/** Evento typing indicator */
export interface WsTypingEvent {
  userId: number;
  roomId: string;
  typing: boolean;
}

/** Evento notifica unread aggiornato */
export interface WsUnreadUpdate {
  userId: number;
  unreadCount: number;
}

@Injectable({ providedIn: 'root' })
export class SocketService {
  private zone = inject(NgZone);

  private client: Client | null = null;
  private currentUserId: number | null = null;

  // ── Stato connessione ──────────────────────────────────────
  private connectedSubject = new BehaviorSubject<boolean>(false);
  connected$ = this.connectedSubject.asObservable();

  // ── Streams per i componenti ───────────────────────────────
  /** Nuovo messaggio in arrivo nella stanza attiva */
  private incomingMessageSubject = new Subject<WsIncomingMessage>();
  incomingMessage$ = this.incomingMessageSubject.asObservable();

  /** Aggiornamento conteggio non letti (push dal server) */
  private unreadUpdateSubject = new Subject<WsUnreadUpdate>();
  unreadUpdate$ = this.unreadUpdateSubject.asObservable();

  /** Typing indicator dall'altro utente */
  private typingSubject = new Subject<WsTypingEvent>();
  typing$ = this.typingSubject.asObservable();

  // ── Subscription attive per stanza ─────────────────────────
  private roomSubscription: StompSubscription | null = null;
  private activeRoomId: string | null = null;
  private notificationSubscription: StompSubscription | null = null;

  // ══════════════════════════════════════════════════════════════
  //  CONNESSIONE
  // ══════════════════════════════════════════════════════════════

  /**
   * Connette al WebSocket backend.
   * Chiama questo metodo al login / dashboard init.
   */
  connect(userId: number): void {
    if (this.client?.connected) return;
    this.currentUserId = userId;

    // Converte http(s) in ws(s) per WebSocket nativo
    const wsUrl = environment.apiUrl.replace(/^http/, 'ws') + '/ws/websocket';

    this.client = new Client({
      brokerURL: wsUrl,
      connectHeaders: {
        userId: userId.toString()
      },
      // Heartbeat: client manda ogni 10s, si aspetta dal server ogni 10s
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      // Riconnessione automatica con backoff
      reconnectDelay: 3000,

      onConnect: () => {
        this.zone.run(() => {
          this.connectedSubject.next(true);
          console.log('[WS] Connesso come userId:', userId);
          // Sottoscrivi al canale notifiche personali (/user/{id}/queue/notifications)
          this.subscribeNotifications(userId);
        });
      },

      onDisconnect: () => {
        this.zone.run(() => {
          this.connectedSubject.next(false);
          console.log('[WS] Disconnesso');
        });
      },

      onStompError: (frame) => {
        console.error('[WS] Errore STOMP:', frame.headers['message'], frame.body);
      },

      onWebSocketClose: () => {
        this.zone.run(() => {
          this.connectedSubject.next(false);
        });
      }
    });

    this.client.activate();
  }

  /**
   * Disconnette e pulisce tutte le subscription.
   * Chiama al logout / distruzione dashboard.
   */
  disconnect(): void {
    this.leaveRoom();
    this.unsubscribeNotifications();
    if (this.client) {
      this.client.deactivate();
      this.client = null;
    }
    this.currentUserId = null;
    this.connectedSubject.next(false);
  }

  // ══════════════════════════════════════════════════════════════
  //  GESTIONE STANZE (ROOMS)
  // ══════════════════════════════════════════════════════════════

  /**
   * Genera un roomId deterministico tra due utenti.
   * Il roomId è sempre lo stesso indipendentemente dall'ordine: "chat_5_12"
   */
  getRoomId(userId1: number, userId2: number): string {
    const ids = [userId1, userId2].sort((a, b) => a - b);
    return `chat_${ids[0]}_${ids[1]}`;
  }

  /**
   * Entra in una stanza chat specifica.
   * - Invia al server un messaggio di JOIN
   * - Sottoscrive al topic della stanza per ricevere messaggi
   */
  joinRoom(otherUserId: number): void {
    if (!this.client?.connected || !this.currentUserId) return;

    const roomId = this.getRoomId(this.currentUserId, otherUserId);

    // Se siamo già in questa stanza, non fare nulla
    if (this.activeRoomId === roomId && this.roomSubscription) return;

    // Lascia la stanza precedente se diversa
    this.leaveRoom();

    this.activeRoomId = roomId;

    // 1) Sottoscrivi al topic della stanza → ricevi messaggi in real-time
    this.roomSubscription = this.client.subscribe(
      `/topic/room/${roomId}`,
      (message: IMessage) => {
        this.zone.run(() => {
          const payload: WsIncomingMessage = JSON.parse(message.body);
          this.incomingMessageSubject.next(payload);
        });
      }
    );

    // 2) Notifica il server che ci siamo uniti alla stanza
    this.client.publish({
      destination: '/app/chat.join',
      body: JSON.stringify({ userId: this.currentUserId, roomId })
    });

    console.log('[WS] Joined room:', roomId);
  }

  /**
   * Lascia la stanza attiva.
   * - Cancella la subscription STOMP
   * - Notifica il server per pulire la memoria
   */
  leaveRoom(): void {
    if (this.roomSubscription) {
      this.roomSubscription.unsubscribe();
      this.roomSubscription = null;
    }

    if (this.activeRoomId && this.client?.connected && this.currentUserId) {
      this.client.publish({
        destination: '/app/chat.leave',
        body: JSON.stringify({ userId: this.currentUserId, roomId: this.activeRoomId })
      });
      console.log('[WS] Left room:', this.activeRoomId);
    }

    this.activeRoomId = null;
  }

  // ══════════════════════════════════════════════════════════════
  //  INVIO MESSAGGI
  // ══════════════════════════════════════════════════════════════

  /**
   * Invia un messaggio via WebSocket.
   * Il server lo inoltrerà IMMEDIATAMENTE alla stanza e poi lo salverà in DB in modo asincrono.
   */
  sendMessage(senderId: number, receiverId: number, content: string): void {
    if (!this.client?.connected) return;

    const roomId = this.getRoomId(senderId, receiverId);
    this.client.publish({
      destination: '/app/chat.send',
      body: JSON.stringify({
        senderId,
        receiverId,
        content,
        roomId
      })
    });
  }

  /**
   * Invia typing indicator.
   */
  sendTyping(receiverId: number, typing: boolean): void {
    if (!this.client?.connected || !this.currentUserId) return;

    const roomId = this.getRoomId(this.currentUserId, receiverId);
    this.client.publish({
      destination: '/app/chat.typing',
      body: JSON.stringify({
        userId: this.currentUserId,
        roomId,
        typing
      })
    });
  }

  /**
   * Notifica il server che i messaggi sono stati letti.
   */
  markAsRead(otherUserId: number): void {
    if (!this.client?.connected || !this.currentUserId) return;

    const roomId = this.getRoomId(this.currentUserId, otherUserId);
    this.client.publish({
      destination: '/app/chat.read',
      body: JSON.stringify({
        userId: this.currentUserId,
        otherUserId,
        roomId
      })
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  NOTIFICHE PERSONALI (canale privato)
  // ══════════════════════════════════════════════════════════════

  private subscribeNotifications(userId: number): void {
    if (!this.client?.connected) return;

    // Canale personale: il server manda qui gli aggiornamenti unread count
    // e notifiche di nuovi messaggi quando l'utente NON è nella stanza
    this.notificationSubscription = this.client.subscribe(
      `/user/${userId}/queue/notifications`,
      (message: IMessage) => {
        this.zone.run(() => {
          const payload = JSON.parse(message.body);

          if (payload.type === 'UNREAD_UPDATE') {
            this.unreadUpdateSubject.next({
              userId: payload.userId,
              unreadCount: payload.unreadCount
            });
          } else if (payload.type === 'NEW_MESSAGE') {
            // Messaggio ricevuto mentre NON sei nella stanza → aggiorna badge
            this.incomingMessageSubject.next(payload.message);
          }
        });
      }
    );
  }

  private unsubscribeNotifications(): void {
    if (this.notificationSubscription) {
      this.notificationSubscription.unsubscribe();
      this.notificationSubscription = null;
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  HELPERS
  // ══════════════════════════════════════════════════════════════

  get isConnected(): boolean {
    return this.client?.connected ?? false;
  }

  get userId(): number | null {
    return this.currentUserId;
  }

  get currentRoomId(): string | null {
    return this.activeRoomId;
  }
}


