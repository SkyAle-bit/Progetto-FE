import { Component, Input, inject, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatMessage, Conversation } from '../../../../services/chat.service';

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
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  @Input() currentUser: any;
  @Input() isProfessional: boolean = false;
  @Input() isClient: boolean = false;
  @Input() professionals: any[] = [];
  @Input() myClients: any[] = [];

  chatConversations: Conversation[] = [];
  chatMessages: ChatMessage[] = [];
  activeConversation: Conversation | null = null;
  chatInput: string = '';
  chatLoading: boolean = false;
  chatView: 'list' | 'conversation' = 'list';
  private chatSubscription: any = null;

  ngOnInit(): void {
    this.loadConversations();
    // Subscribe to conversation updates from global polling
    this.chatService.conversations$.subscribe(convs => {
      if (convs && convs.length > 0) {
        const backendIds = new Set(convs.map(c => c.otherUserId));
        const localContacts = this.buildLocalConversations();
        const localOnly = localContacts.filter(lc => !backendIds.has(lc.otherUserId));
        this.chatConversations = [...convs, ...localOnly];
        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.chatSubscription) { this.chatSubscription.unsubscribe(); this.chatSubscription = null; }
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
    return convs;
  }

  openConversation(conv: Conversation): void {
    this.activeConversation = conv;
    this.chatView = 'conversation';
    this.chatMessages = [];
    this.chatLoading = true;
    if (this.chatSubscription) { this.chatSubscription.unsubscribe(); this.chatSubscription = null; }
    this.chatService.getMessages(this.currentUser.id, conv.otherUserId).subscribe({
      next: (msgs) => { this.chatMessages = this.sortMessages(msgs); this.chatLoading = false; this.cdr.detectChanges(); setTimeout(() => this.scrollToBottom(), 50); },
      error: () => { this.chatLoading = false; this.cdr.detectChanges(); }
    });
    this.chatService.markAsRead(this.currentUser.id, conv.otherUserId).subscribe();
    conv.unreadCount = 0;
    this.chatService.startMessagePolling(this.currentUser.id, conv.otherUserId);
    this.chatSubscription = this.chatService.messages$.subscribe(msgs => {
      if (msgs.length > 0 && msgs.length !== this.chatMessages.length) {
        this.chatMessages = this.sortMessages(msgs);
        this.cdr.detectChanges();
        setTimeout(() => this.scrollToBottom(), 50);
      }
    });
  }

  sendChatMessage(): void {
    const text = this.chatInput.trim();
    if (!text || !this.activeConversation) return;
    const receiverId = this.activeConversation.otherUserId;
    const localMsg: ChatMessage = { id: Date.now(), senderId: this.currentUser.id, senderName: `${this.currentUser.firstName} ${this.currentUser.lastName}`, receiverId, receiverName: this.activeConversation.otherUserName, content: text, status: 'SENT', createdAt: new Date().toISOString() };
    this.chatMessages = [...this.chatMessages, localMsg];
    this.chatInput = '';
    this.cdr.detectChanges();
    this.scrollToBottom();
    if (this.activeConversation) { this.activeConversation.lastMessage = text; this.activeConversation.lastMessageTime = localMsg.createdAt; }
    this.chatService.sendMessage({ senderId: this.currentUser.id, receiverId, content: text }).subscribe({
      next: (savedMsg) => { this.chatMessages = this.chatMessages.map(m => m.id === localMsg.id ? savedMsg : m); this.cdr.detectChanges(); },
      error: (err) => { console.warn('Errore invio messaggio', err); }
    });
  }

  backToConversations(): void {
    this.chatView = 'list'; this.activeConversation = null; this.chatMessages = [];
    if (this.chatSubscription) { this.chatSubscription.unsubscribe(); this.chatSubscription = null; }
    this.chatService.clearMessages(); this.chatService.stopMessagePolling(); this.loadConversations();
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
