import { Component, Input, inject, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatMessage, Conversation } from '../../../../services/chat.service';
import { SocketService } from '../../../../services/socket.service';

@Component({
  selector: 'app-chat-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-tab.html',
  styleUrls: ['./chat-tab.css'],
  encapsulation: ViewEncapsulation.None
})
export class ChatTabComponent implements OnInit, OnDestroy {
  private chatService = inject(ChatService);
  private socketService = inject(SocketService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  @Input() currentUser: any;
  @Input() isProfessional: boolean = false;
  @Input() isClient: boolean = false;
  @Input() isInsurance: boolean = false;
  @Input() isAdmin: boolean = false;
  @Input() professionals: any[] = [];
  @Input() myClients: any[] = [];
  @Input() allUsers: any[] = [];

  chatConversations: Conversation[] = [];
  chatMessages: ChatMessage[] = [];
  activeConversation: Conversation | null = null;
  chatInput: string = '';
  chatLoading: boolean = false;
  chatView: 'list' | 'conversation' = 'list';
  private subscriptions: any[] = [];

  // User picker (admin)
  showUserPicker: boolean = false;
  userPickerSearch: string = '';

  get filteredPickerUsers(): any[] {
    if (!this.allUsers?.length) return [];
    let users = this.allUsers.filter(u => u.id !== this.currentUser?.id);
    // Escludi quelli già in conversazione
    const existingIds = new Set(this.chatConversations.map(c => c.otherUserId));
    users = users.filter(u => !existingIds.has(u.id));
    if (this.userPickerSearch.trim()) {
      const q = this.userPickerSearch.toLowerCase();
      users = users.filter(u => (u.firstName + ' ' + u.lastName).toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
    }
    return users;
  }

  startConversationWith(user: any): void {
    const conv: Conversation = {
      otherUserId: user.id,
      otherUserName: `${user.firstName} ${user.lastName}`,
      otherUserRole: this.getRoleLabel(user.role),
      lastMessage: undefined,
      lastMessageTime: undefined,
      unreadCount: 0
    };
    this.chatConversations = [conv, ...this.chatConversations];
    this.showUserPicker = false;
    this.userPickerSearch = '';
    this.openConversation(conv);
  }

  getRoleLabel(role: string): string {
    switch (role) {
      case 'CLIENT': return 'Cliente';
      case 'PERSONAL_TRAINER': return 'Personal Trainer';
      case 'NUTRITIONIST': return 'Nutrizionista';
      case 'ADMIN': return 'Admin';
      case 'INSURANCE_MANAGER': return 'Assicurazione';
      default: return role;
    }
  }

  ngOnInit(): void {
    this.loadConversations();

    // Ripristina conversazione attiva dal service (sopravvive alla distruzione del componente)
    const savedConv = this.chatService.activeConversation;
    const currentMsgs = this.chatService.getMessagesSnapshot();
    if (savedConv && currentMsgs.length > 0) {
      this.activeConversation = savedConv;
      this.chatMessages = this.sortMessages(currentMsgs);
      this.chatView = 'conversation';
      setTimeout(() => this.scrollToBottom(), 100);
    }

    // Subscribe to conversation updates (da polling globale + WS)
    const convSub = this.chatService.conversations$.subscribe(convs => {
      const backendConvs = convs ?? [];
      const backendIds = new Set(backendConvs.map(c => c.otherUserId));
      const localContacts = this.buildLocalConversations();
      const localOnly = localContacts.filter(lc => !backendIds.has(lc.otherUserId));
      this.chatConversations = [...backendConvs, ...localOnly];
      this.cdr.detectChanges();
    });
    this.subscriptions.push(convSub);

    // Subscribe a messaggi real-time dal WebSocket (per la conversazione attiva)
    const msgSub = this.chatService.messages$.subscribe(msgs => {
      if (this.activeConversation && msgs.length > 0) {
        // Ordina i messaggi e aggiorna solo se c'è una variazione
        const sorted = this.sortMessages(msgs);
        if (sorted.length !== this.chatMessages.length ||
            (sorted.length > 0 && sorted[sorted.length - 1].id !== this.chatMessages[this.chatMessages.length - 1]?.id)) {
          this.chatMessages = sorted;
          this.cdr.detectChanges();
          setTimeout(() => this.scrollToBottom(), 50);
        }
      }
    });
    this.subscriptions.push(msgSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
    this.subscriptions = [];
    // NON chiamare leaveRoom/clearMessages qui — l'utente potrebbe tornare alla chat
    this.chatService.stopMessagePolling();
  }

  loadConversations(): void {
    if (!this.currentUser) return;
    this.chatLoading = true;
    this.chatService.getConversations(this.currentUser.id).subscribe({
      next: (convs) => {
        const localContacts = this.buildLocalConversations();
        if (convs && convs.length > 0) {
          const backendIds = new Set(convs.map(c => c.otherUserId));
          const localOnly = localContacts.filter(lc => !backendIds.has(lc.otherUserId));
          this.chatConversations = [...convs, ...localOnly];
        } else {
          this.chatConversations = localContacts;
        }
        this.chatLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.chatConversations = this.buildLocalConversations(); this.chatLoading = false; this.cdr.detectChanges(); }
    });
  }

  buildLocalConversations(): Conversation[] {
    const convs: Conversation[] = [];
    if (this.isClient && this.professionals?.length > 0) {
      this.professionals.forEach((p: any) => {
        convs.push({ otherUserId: p.id, otherUserName: p.fullName, otherUserRole: p.role === 'PERSONAL_TRAINER' ? 'Personal Trainer' : 'Nutrizionista', lastMessage: undefined, lastMessageTime: undefined, unreadCount: 0 });
      });
    }
    if (this.isProfessional && this.myClients?.length > 0) {
      this.myClients.forEach((c: any) => {
        convs.push({ otherUserId: c.id, otherUserName: `${c.firstName} ${c.lastName}`, otherUserRole: 'Cliente', lastMessage: undefined, lastMessageTime: undefined, unreadCount: 0 });
      });
    }
    // Insurance Manager: può chattare solo con Admin
    if (this.isInsurance && this.allUsers?.length > 0) {
      this.allUsers.filter(u => u.role === 'ADMIN').forEach((a: any) => {
        convs.push({ otherUserId: a.id, otherUserName: `${a.firstName} ${a.lastName}`, otherUserRole: 'Admin', lastMessage: undefined, lastMessageTime: undefined, unreadCount: 0 });
      });
    }
    // Admin: può chattare con Insurance Manager (e gli altri contatti se servono)
    if (this.isAdmin && this.allUsers?.length > 0) {
      this.allUsers.filter(u => u.role === 'INSURANCE_MANAGER').forEach((im: any) => {
        convs.push({ otherUserId: im.id, otherUserName: `${im.firstName} ${im.lastName}`, otherUserRole: 'Assicurazione', lastMessage: undefined, lastMessageTime: undefined, unreadCount: 0 });
      });
    }
    return convs;
  }

  openConversation(conv: Conversation): void {
    this.activeConversation = conv;
    this.chatService.activeConversation = conv;  // Persisti nel service
    this.chatView = 'conversation';
    this.chatLoading = true;

    // Entra nella stanza WebSocket
    this.chatService.joinRoom(conv.otherUserId);

    // Carica storico messaggi via REST e unisci con eventuali messaggi locali ottimistici
    this.chatService.getMessages(this.currentUser.id, conv.otherUserId).subscribe({
      next: (serverMsgs) => {
        // Mantieni i messaggi locali ottimistici (id < 0) non ancora confermati dal server
        const localOptimistic = this.chatMessages.filter(m => m.id < 0 &&
          !serverMsgs.some(sm => sm.senderId === m.senderId && sm.content === m.content));
        this.chatMessages = this.sortMessages([...serverMsgs, ...localOptimistic]);
        this.chatLoading = false;
        this.cdr.detectChanges();
        setTimeout(() => this.scrollToBottom(), 50);
      },
      error: () => { this.chatLoading = false; this.cdr.detectChanges(); }
    });

    // Segna come letti (via WS se connesso, altrimenti REST)
    if (this.socketService.isConnected) {
      this.chatService.markAsReadRealTime(conv.otherUserId);
    } else {
      this.chatService.markAsRead(this.currentUser.id, conv.otherUserId).subscribe();
    }
    conv.unreadCount = 0;

    // Avvia polling messaggi solo come fallback se WS non è connesso
    this.chatService.startMessagePolling(this.currentUser.id, conv.otherUserId);
  }

  sendChatMessage(): void {
    const text = this.chatInput.trim();
    if (!text || !this.activeConversation) return;

    const receiverId = this.activeConversation.otherUserId;
    const senderName = `${this.currentUser.firstName} ${this.currentUser.lastName}`;
    const receiverName = this.activeConversation.otherUserName;

    if (this.socketService.isConnected) {
      // ── Real-time via WebSocket ──
      const localMsg = this.chatService.sendMessageRealTime(
        this.currentUser.id, receiverId, text, senderName, receiverName
      );
      this.chatMessages = [...this.chatMessages, localMsg];
      this.chatInput = '';
      this.cdr.detectChanges();
      this.scrollToBottom();

      // Aggiorna preview conversazione
      if (this.activeConversation) {
        this.activeConversation.lastMessage = text;
        this.activeConversation.lastMessageTime = localMsg.createdAt;
      }
    } else {
      // ── Fallback REST ──
      const localMsg: ChatMessage = {
        id: -Date.now(),
        senderId: this.currentUser.id,
        senderName,
        receiverId,
        receiverName,
        content: text,
        status: 'SENT',
        createdAt: new Date().toISOString()
      };
      this.chatMessages = [...this.chatMessages, localMsg];
      this.chatInput = '';
      this.cdr.detectChanges();
      this.scrollToBottom();

      if (this.activeConversation) {
        this.activeConversation.lastMessage = text;
        this.activeConversation.lastMessageTime = localMsg.createdAt;
      }

      this.chatService.sendMessage({ senderId: this.currentUser.id, receiverId, content: text }).subscribe({
        next: (savedMsg) => {
          this.chatMessages = this.chatMessages.map(m => m.id === localMsg.id ? savedMsg : m);
          this.cdr.detectChanges();
        },
        error: (err) => { console.warn('Errore invio messaggio', err); }
      });
    }
  }

  backToConversations(): void {
    this.chatView = 'list';
    this.activeConversation = null;
    this.chatService.activeConversation = null;  // Pulisci nel service
    this.chatMessages = [];

    // Lascia la stanza WebSocket
    this.chatService.leaveRoom();
    this.chatService.clearMessages();
    this.chatService.stopMessagePolling();
    this.loadConversations();
  }

  isMyMessage(msg: ChatMessage): boolean { return msg.senderId === this.currentUser?.id; }

  private parseMessageDate(isoString: string): Date {
    if (!isoString) return new Date();
    if (!isoString.endsWith('Z') && !isoString.includes('+') && !/\d{2}-\d{2}$/.test(isoString)) return new Date(isoString + 'Z');
    return new Date(isoString);
  }

  private sortMessages(msgs: ChatMessage[]): ChatMessage[] {
    return [...msgs].sort((a, b) => this.parseMessageDate(a.createdAt).getTime() - this.parseMessageDate(b.createdAt).getTime());
  }

  formatChatTime(isoString: string): string {
    if (!isoString) return '';
    const d = this.parseMessageDate(isoString); const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return time;
    if (isYesterday) return `Ieri ${time}`;
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) + ` ${time}`;
  }

  formatConvTime(isoString?: string): string {
    if (!isoString) return '';
    const d = this.parseMessageDate(isoString); const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Ieri';
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  }

  getConversationInitials(conv: Conversation): string {
    return conv.otherUserName.split(' ').map(p => p.charAt(0)).join('').substring(0, 2).toUpperCase();
  }

  trackConversation(index: number, conv: Conversation): number { return conv.otherUserId; }
  trackMessage(index: number, msg: ChatMessage): number { return msg.id; }

  private scrollToBottom(): void {
    try { if (this.messagesContainer) { const el = this.messagesContainer.nativeElement; el.scrollTop = el.scrollHeight; } } catch (e) {}
  }

  autoGrow(event: Event): void { const el = event.target as HTMLTextAreaElement; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }

  onChatKeydown(event: KeyboardEvent): void { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); this.sendChatMessage(); } }
}
