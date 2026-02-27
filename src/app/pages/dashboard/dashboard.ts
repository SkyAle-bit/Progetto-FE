import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ChatService, ChatMessage, Conversation } from '../../services/chat.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private chatService = inject(ChatService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  currentUser: any = null;
  dashboardData: any = null;
  isLoading: boolean = true;
  isProfileOpen: boolean = false;
  myClients: any[] = []; // Array per la quick view nel profilo

  // ── Tab mobile ────────────────────────────────────────────
  activeTab: string = 'home'; // 'home' | 'calendar' | 'chat' | 'clients' | 'professionals'

  // ── Chat ──────────────────────────────────────────────────
  chatConversations: Conversation[] = [];
  chatMessages: ChatMessage[] = [];
  activeConversation: Conversation | null = null;
  chatInput: string = '';
  chatLoading: boolean = false;
  chatView: 'list' | 'conversation' = 'list';

  // ── Modale Successo Globale ───────────────────────────────
  isPopupOpen: boolean = false;
  popupTitle: string = '';
  popupMessage: string = '';

  openPopup(title: string, message: string): void {
    this.popupTitle = title;
    this.popupMessage = message;
    this.isPopupOpen = true;
  }

  closePopup(): void {
    this.isPopupOpen = false;
  }

  // ── Disponibilità ─────────────────────────────────────────
  isAvailabilityOpen: boolean = false;
  nextWeekDays: Date[] = [];
  selectedSlots: Set<string> = new Set();
  existingSlots: Set<string> = new Set();
  existingSlotIds: Map<string, number> = new Map();
  lockedSlots: Set<string> = new Set();

  // ── Prenotazione Cliente ──────────────────────────────────
  isBookingOpen: boolean = false;
  selectedProfessional: any = null;
  availableBookingSlots: any[] = [];
  selectedBookingSlot: any = null;

  bookingDays: Date[] = [];
  selectedBookingDay: Date | null = null;
  slotsForSelectedDay: any[] = [];

  currentWeekStart: Date = new Date();
  weekDays: Date[] = [];
  timeSlots: string[] = [];
  readonly START_HOUR = 8;
  readonly END_HOUR = 21;

  visibleDayCount: number = 7;
  dayOffset: number = 0;
  agendaView: boolean = false;
  // ── Accesso Call (Modal) ──────────────────────────────────
  isCallModalOpen: boolean = false;
  selectedCallBooking: any = null;
  canJoinCallNow: boolean = false;
  private timeCheckInterval: any;

  ngOnInit(): void {
    const userString = localStorage.getItem('user');
    if (userString) {
      this.currentUser = JSON.parse(userString);
      this.initWeek();
      this.buildTimeSlots();
      this.updateVisibleDays();
      this.loadDashboardData();
    } else {
      this.router.navigate(['/login']);
    }
  }

  ngOnDestroy(): void {
    if (this.timeCheckInterval) {
      clearInterval(this.timeCheckInterval);
    }
    this.chatService.stopPolling();
  }

  // ── Responsive ───────────────────────────────────────────

  @HostListener('window:resize')
  onResize(): void {
    this.updateVisibleDays();
    this.cdr.detectChanges();
  }

  updateVisibleDays(): void {
    const w = window.innerWidth;
    if (w <= 640) {
      this.visibleDayCount = 3;          // mobile: 3 giorni (come tablet)
    } else if (w <= 1024) {
      this.visibleDayCount = 3;          // tablet
    } else {
      this.visibleDayCount = 7;          // desktop
    }
    this.buildWeekDays();
  }

  // ── Agenda view ────────────────────────────────────────────
  toggleAgendaView(): void {
    this.agendaView = !this.agendaView;
  }

  /** Restituisce i prossimi 14 giorni che hanno almeno una prenotazione,
   *  più oggi e i prossimi 2 giorni anche se vuoti (per orientamento). */
  getAgendaDays(): Date[] {
    const days: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const hasBk = this.getBookingsForAgendaDay(d).length > 0;
      if (hasBk || i < 3) days.push(d);
    }
    return days;
  }

  getBookingsForAgendaDay(day: Date): any[] {
    const dateStr = this.formatDate(day);
    return (this.bookings || [])
      .filter((b: any) => b.date === dateStr)
      .sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || ''));
  }

  getMonthShort(date: Date): string {
    return date.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '');
  }

  // ── Caricamento dati ─────────────────────────────────────

  loadDashboardData(): void {
    this.authService.getDashboard(this.currentUser.id).subscribe({
      next: (data) => {
        this.dashboardData = data;

        // Se è un professionista, carichiamo anche i suoi clienti per il pannello laterale
        if (this.isProfessional()) {
          this.authService.getMyClients(this.currentUser.id).subscribe({
            next: (res: any) => {
              this.myClients = Array.isArray(res) ? res : (res && res.value) ? res.value : [];
              this.isLoading = false;
              this.cdr.detectChanges();
            },
            error: (err) => {
              console.error('Errore caricamento mini-lista clienti', err);
              this.isLoading = false;
              this.cdr.detectChanges();
            }
          });
        } else {
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Errore nel caricamento della dashboard', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Accessori dati ───────────────────────────────────────

  get profile() { return this.dashboardData?.profile; }
  get subscription() { return this.dashboardData?.subscription; }
  get professionals() { return this.dashboardData?.followingProfessionals ?? []; }
  get bookings(): any[] { return this.dashboardData?.upcomingBookings ?? []; }

  isClient(): boolean { return this.currentUser?.role === 'CLIENT'; }
  isProfessional(): boolean {
    const r = this.currentUser?.role;
    return r === 'PERSONAL_TRAINER' || r === 'NUTRITIONIST';
  }

  goToClients(): void {
    this.router.navigate(['/clients']);
  }

  setTab(tab: string): void {
    this.activeTab = tab;
    // Se si entra nel tab calendario, disattiva agendaView mobile
    if (tab === 'calendar') {
      this.agendaView = false;
    }
    // Se si entra nel tab chat, carica le conversazioni
    if (tab === 'chat') {
      this.chatView = 'list';
      this.activeConversation = null;
      this.loadConversations();
    } else {
      // Se si esce dal chat, ferma il polling
      this.chatService.stopPolling();
    }
    this.cdr.detectChanges();
  }

  // ── Calendario ───────────────────────────────────────────

  initWeek(): void {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    this.currentWeekStart = new Date(today);
    this.currentWeekStart.setDate(today.getDate() + diff);
    this.currentWeekStart.setHours(0, 0, 0, 0);
    this.dayOffset = 0;
    this.buildWeekDays();
  }

  buildWeekDays(): void {
    this.weekDays = [];
    const count = this.visibleDayCount || 7;
    for (let i = 0; i < count; i++) {
      const d = new Date(this.currentWeekStart);
      d.setDate(this.currentWeekStart.getDate() + this.dayOffset + i);
      this.weekDays.push(d);
    }
  }

  buildTimeSlots(): void {
    this.timeSlots = [];
    for (let h = this.START_HOUR; h < this.END_HOUR; h++) {
      this.timeSlots.push(`${h.toString().padStart(2, '0')}:00`);
      this.timeSlots.push(`${h.toString().padStart(2, '0')}:30`);
    }
  }

  isFullHour(slot: string): boolean { return slot.endsWith(':00'); }

  prevWeek(): void {
    if (this.visibleDayCount === 7) {
      const d = new Date(this.currentWeekStart);
      d.setDate(d.getDate() - 7);
      this.currentWeekStart = d;
      this.dayOffset = 0;
    } else {
      this.dayOffset -= this.visibleDayCount;
      const minOffset = -28;
      if (this.dayOffset < minOffset) this.dayOffset = minOffset;
    }
    this.buildWeekDays();
  }

  nextWeek(): void {
    if (this.visibleDayCount === 7) {
      const d = new Date(this.currentWeekStart);
      d.setDate(d.getDate() + 7);
      this.currentWeekStart = d;
      this.dayOffset = 0;
    } else {
      this.dayOffset += this.visibleDayCount;
      const maxOffset = 56;
      if (this.dayOffset > maxOffset) this.dayOffset = maxOffset;
    }
    this.buildWeekDays();
  }

  goToToday(): void {
    this.initWeek();
    this.updateVisibleDays();
    // On tablet/mobile (3-day view), dayOffset = 0 shows Mon.
    // Adjust offset to the closest 3-day window containing today.
    if (this.visibleDayCount < 7) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const monday = new Date(this.currentWeekStart);
      const diffDays = Math.round((today.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24));
      // Snap to the 3-day block that contains today
      this.dayOffset = Math.floor(diffDays / this.visibleDayCount) * this.visibleDayCount;
      this.buildWeekDays();
    }
  }

  isToday(date: Date): boolean {
    return date.toDateString() === new Date().toDateString();
  }

  getWeekLabel(): string {
    if (this.weekDays.length === 0) return '';
    const first = this.weekDays[0];
    const last = this.weekDays[this.weekDays.length - 1];
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };

    if (this.visibleDayCount === 1) {
      return first.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
    }
    if (this.visibleDayCount === 3) {
      return `${first.toLocaleDateString('it-IT', opts)} – ${last.toLocaleDateString('it-IT', opts)}`;
    }
    const optsLong: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
    return `${first.toLocaleDateString('it-IT', optsLong)} – ${last.toLocaleDateString('it-IT', { ...optsLong, year: 'numeric' })}`;
  }

  formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  toDate(dateStr: string): Date {
    return new Date(dateStr + 'T00:00:00');
  }

  getDayName(date: Date): string {
    return date.toLocaleDateString('it-IT', { weekday: 'short' }).toUpperCase();
  }

  getDayNumber(date: Date): number { return date.getDate(); }

  getBookingsForSlot(day: Date, timeSlot: string): any[] {
    const dateStr = this.formatDate(day);
    const [slotH, slotM] = timeSlot.split(':').map(Number);
    return this.bookings.filter(b => {
      if (b.date !== dateStr) return false;
      const [bH, bM] = (b.startTime ?? '00:00').split(':').map(Number);
      return bH === slotH && bM === slotM;
    });
  }

  getBookingLabel(b: any): string {
    if (this.isClient()) {
      const role = b.professionalRole === 'PERSONAL_TRAINER' ? 'PT' : 'Nutr.';
      return `${role} – ${b.professionalName ?? ''}`;
    }
    return b.clientName ?? '';
  }

  getBookingClass(b: any): string {
    if (b.status === 'CANCELLED') return 'booking-cancelled';
    if (b.professionalRole === 'NUTRITIONIST') return 'booking-nutrition';
    return 'booking-pt';
  }

  countWeekBookings(): number {
    return this.weekDays.reduce((acc, day) =>
      acc + this.bookings.filter(b => b.date === this.formatDate(day)).length, 0);
  }

  // ── Profilo ──────────────────────────────────────────────

  toggleProfile(): void { this.isProfileOpen = !this.isProfileOpen; }
  closeProfile(): void { this.isProfileOpen = false; }

  getInitials(): string {
    const f = (this.currentUser?.firstName ?? '').charAt(0);
    const l = (this.currentUser?.lastName ?? '').charAt(0);
    return (f + l).toUpperCase();
  }

  getSubscriptionDaysLeft(): number {
    if (!this.subscription?.endDate) return 0;
    const end = new Date(this.subscription.endDate);
    return Math.max(0, Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  }

  // ── Disponibilità ────────────────────────────────────────

  buildNextWeekDays(): void {
    this.nextWeekDays = [];
    const today = new Date();
    const day = today.getDay();
    // Lunedì della settimana prossima
    const daysUntilNextMonday = day === 0 ? 1 : 8 - day;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilNextMonday);
    nextMonday.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(nextMonday);
      d.setDate(nextMonday.getDate() + i);
      this.nextWeekDays.push(d);
    }
  }

  openAvailability(): void {
    this.buildNextWeekDays();
    this.selectedSlots.clear();
    this.existingSlots.clear();
    this.existingSlotIds.clear();
    this.lockedSlots.clear();
    this.isAvailabilityOpen = true;
    this.isLoading = true;

    this.authService.getProfessionalSlots(this.currentUser.id).subscribe({
      next: (slots: any[]) => {
        slots.forEach(slot => {
          const start = new Date(slot.startTime);
          const timeLabel = `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`;
          const key = this.slotKey(start, timeLabel);

          this.existingSlots.add(key);
          this.existingSlotIds.set(key, slot.id);
          // Se lo slot è prenotato (isAvailable == false o available == false), lo blocchiamo
          if (slot.isAvailable === false || slot.available === false) {
            this.lockedSlots.add(key);
          }
        });
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Errore nel caricamento disponibilità esistente', err);
        // Anche in caso di errore apriamo la modale vuota e sblocchiamo il loading
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  closeAvailability(): void {
    this.isAvailabilityOpen = false;
  }

  slotKey(day: Date, slot: string): string {
    return `${this.formatDate(day)}|${slot}`;
  }

  toggleSlot(day: Date, slot: string): void {
    const key = this.slotKey(day, slot);

    if (this.existingSlots.has(key)) {
      if (this.lockedSlots.has(key)) {
        this.openPopup('Slot Prenotato', 'Questo slot è già stato prenotato da un cliente e non può essere rimosso.');
      } else {
        const slotId = this.existingSlotIds.get(key);
        if (slotId && confirm('Vuoi rimuovere questa disponibilità?')) {
          this.isLoading = true;
          this.authService.deleteProfessionalSlot(this.currentUser.id, slotId).subscribe({
            next: () => {
              this.existingSlots.delete(key);
              this.existingSlotIds.delete(key);
              this.isLoading = false;
              this.cdr.detectChanges();
              this.loadDashboardData();
            },
            error: (err) => {
              console.error('Errore rimozione slot', err);
              this.isLoading = false;
              this.openPopup('Errore', 'Impossibile rimuovere lo slot in questo momento.');
              this.cdr.detectChanges();
            }
          });
        }
      }
      return;
    }

    if (this.selectedSlots.has(key)) {
      this.selectedSlots.delete(key);
    } else {
      this.selectedSlots.add(key);
    }
  }

  isSlotSelected(day: Date, slot: string): boolean {
    return this.selectedSlots.has(this.slotKey(day, slot));
  }

  isSlotExisting(day: Date, slot: string): boolean {
    return this.existingSlots.has(this.slotKey(day, slot));
  }

  isSlotLocked(day: Date, slot: string): boolean {
    return this.lockedSlots.has(this.slotKey(day, slot));
  }

  getSelectedCount(): number {
    return this.selectedSlots.size;
  }

  confirmAvailability(): void {
    if (this.selectedSlots.size === 0) {
      alert("Nessuno slot selezionato.");
      return;
    }

    this.isLoading = true;

    const slotsPayload = Array.from(this.selectedSlots).map(key => {
      const [date, time] = key.split('|');

      const startStr = `${date}T${time}:00`;
      const startDate = new Date(startStr);
      // Aggiunge 30 minuti per calcolare l'endTime
      const endDate = new Date(startDate.getTime() + 30 * 60000);

      const pad = (n: number) => n.toString().padStart(2, '0');
      const endStr = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}:00`;

      return {
        startTime: startStr,
        endTime: endStr,
        isAvailable: true
      };
    });

    this.authService.createProfessionalSlots(this.currentUser.id, slotsPayload).subscribe({
      next: () => {
        this.openPopup('Disponibilità Confermate', 'I tuoi slot sono stati salvati con successo. I clienti potranno ora prenotarli.');
        this.selectedSlots.clear();
        this.copiedDay = null;
        this.isLoading = false;
        this.closeAvailability();
        // Ricarica la dashboard per riflettere le modifiche (se la view mostra gli slot del prof)
        this.loadDashboardData();
      },
      error: (err) => {
        console.error('Errore salvataggio disponibilità', err);
        this.openPopup('Errore', 'Si è verificato un errore durante il salvataggio. Riprova più tardi.');
        this.isLoading = false;
      }
    });
  }

  /** Clipboard per il copia/incolla giorno */
  copiedDay: Date | null = null;

  get isCopyMode(): boolean { return this.copiedDay !== null; }

  /** Verifica se un giorno ha slot selezionati */
  hasDaySlots(day: Date): boolean {
    return this.timeSlots.some(slot => this.isSlotSelected(day, slot));
  }

  /** Verifica se questo giorno è quello copiato */
  isCopiedDay(day: Date): boolean {
    return this.copiedDay !== null && this.formatDate(this.copiedDay) === this.formatDate(day);
  }

  /** Memorizza il giorno come sorgente copia */
  copyDay(day: Date): void {
    this.copiedDay = day;
  }

  /** Annulla la copia */
  clearCopy(): void {
    this.copiedDay = null;
  }

  /** Incolla gli slot del giorno copiato nel giorno destinazione */
  pasteDay(targetDay: Date): void {
    if (!this.copiedDay) return;
    const sourceSlots = this.timeSlots.filter(slot => this.isSlotSelected(this.copiedDay!, slot));
    sourceSlots.forEach(slot => this.selectedSlots.add(this.slotKey(targetDay, slot)));
    this.copiedDay = null;
  }

  getNextWeekLabel(): string {
    if (this.nextWeekDays.length === 0) return '';
    const first = this.nextWeekDays[0];
    const last = this.nextWeekDays[6];
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
    return `${first.toLocaleDateString('it-IT', opts)} – ${last.toLocaleDateString('it-IT', { ...opts, year: 'numeric' })}`;
  }

  // ── Prenotazione Cliente ──────────────────────────────────

  openBooking(professional: any): void {
    this.selectedProfessional = professional;
    this.isLoading = true;
    this.isBookingOpen = true;
    this.availableBookingSlots = [];
    this.bookingDays = [];
    this.selectedBookingDay = null;
    this.slotsForSelectedDay = [];
    this.selectedBookingSlot = null;

    this.authService.getProfessionalSlots(professional.id).subscribe({
      next: (slots) => {
        this.availableBookingSlots = slots.filter((s: any) => s.available === true || s.isAvailable === true);
        this.buildBookingDays();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Errore nel caricamento degli slot', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  closeBooking(): void {
    this.isBookingOpen = false;
    this.selectedProfessional = null;
    this.availableBookingSlots = [];
    this.bookingDays = [];
    this.selectedBookingDay = null;
    this.slotsForSelectedDay = [];
    this.selectedBookingSlot = null;
  }

  buildBookingDays(): void {
    this.bookingDays = [];
    const uniqueDates = new Set<string>();

    this.availableBookingSlots.forEach(s => {
      const d = new Date(s.startTime);
      d.setHours(0, 0, 0, 0);
      uniqueDates.add(d.getTime().toString());
    });

    this.bookingDays = Array.from(uniqueDates)
      .map(timeStr => new Date(Number(timeStr)))
      .sort((a, b) => a.getTime() - b.getTime());

    // Auto-seleziona il primo giorno disponibile
    if (this.bookingDays.length > 0) {
      this.selectBookingDay(this.bookingDays[0]);
    } else {
      this.selectedBookingDay = null;
      this.slotsForSelectedDay = [];
    }
  }

  selectBookingDay(day: Date): void {
    this.selectedBookingDay = day;
    this.selectedBookingSlot = null;
    const dayTime = day.getTime();

    this.slotsForSelectedDay = this.availableBookingSlots.filter(s => {
      const d = new Date(s.startTime);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === dayTime;
    }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  getSlotTimeLabel(slot: any): string {
    const d = new Date(slot.startTime);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  toggleBookingSlot(slot: any): void {
    if (!slot) return;
    if (this.selectedBookingSlot?.id === slot.id) {
      this.selectedBookingSlot = null;
    } else {
      this.selectedBookingSlot = slot;
    }
  }

  isBookingSlotSelected(slot: any): boolean {
    return this.selectedBookingSlot?.id === slot?.id;
  }

  confirmBooking(): void {
    if (!this.selectedBookingSlot || !this.selectedProfessional) return;

    this.isLoading = true;
    const request = {
      userId: this.currentUser.id,
      slotId: this.selectedBookingSlot.id
    };

    this.authService.createBooking(request).subscribe({
      next: (res) => {
        this.openPopup('Prenotazione Confermata', `Hai prenotato con successo un appuntamento per il ${this.selectedBookingDay?.toLocaleDateString('it-IT')} alle ${this.getSlotTimeLabel(this.selectedBookingSlot)}.`);
        this.closeBooking();
        this.loadDashboardData();
      },
      error: (err) => {
        console.error('Errore nella prenotazione', err);
        let errMsg = 'Errore durante la prenotazione';
        if (err.error && err.error.message) errMsg = err.error.message;
        else if (err.error && typeof err.error === 'string') errMsg = err.error;
        this.openPopup('Errore di Prenotazione', errMsg);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Accesso alle Call ────────────────────────────────────

  openCallModal(booking: any): void {
    this.selectedCallBooking = booking;
    this.checkCallTime();
    this.isCallModalOpen = true;

    // Avvia un controllo ogni 10 secondi per abilitare il pulsante se l'utente aspetta nel modal
    if (this.timeCheckInterval) clearInterval(this.timeCheckInterval);
    this.timeCheckInterval = setInterval(() => this.checkCallTime(), 10000);
  }

  closeCallModal(): void {
    this.isCallModalOpen = false;
    this.selectedCallBooking = null;
    if (this.timeCheckInterval) {
      clearInterval(this.timeCheckInterval);
      this.timeCheckInterval = null;
    }
  }

  checkCallTime(): void {
    if (!this.selectedCallBooking || this.selectedCallBooking.status === 'CANCELLED') {
      this.canJoinCallNow = false;
      return;
    }

    // Il backend ci dice già "canJoin" per default, ma implementiamo anche un fallback lato client per live updates
    const b = this.selectedCallBooking;
    if (b.canJoin) {
      this.canJoinCallNow = true;
      return;
    }

    // Fallback: Controlliamo se mancano <= 30 minuti all'inizio
    const dateStr = b.date; // "yyyy-MM-dd"
    const timeStr = b.startTime; // "HH:mm"
    if (!dateStr || !timeStr) {
      this.canJoinCallNow = false;
      return;
    }

    const startDateTime = new Date(`${dateStr}T${timeStr}:00`);
    const now = new Date();

    // allow join se (startTime - now) <= 30 minuti
    const diffMs = startDateTime.getTime() - now.getTime();
    const diffMin = diffMs / 60000;

    this.canJoinCallNow = true;
  }

  joinCall(): void {
    if (!this.canJoinCallNow || !this.selectedCallBooking?.meetingLink) return;

    // Apri il link meeting in una nuova tab
    window.open(this.selectedCallBooking.meetingLink, '_blank');
    this.closeCallModal();
  }

  // ── Chat ──────────────────────────────────────────────────

  loadConversations(): void {
    if (!this.currentUser) return;
    this.chatLoading = true;
    this.chatService.getConversations(this.currentUser.id).subscribe({
      next: (convs) => {
        // Se il backend restituisce conversazioni, usale; altrimenti genera da dati locali
        if (convs && convs.length > 0) {
          this.chatConversations = convs;
        } else {
          this.chatConversations = this.buildLocalConversations();
        }
        this.chatLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.chatConversations = this.buildLocalConversations();
        this.chatLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /** Genera conversazioni locali dai professionisti/clienti per mostrare i contatti anche senza messaggi */
  buildLocalConversations(): Conversation[] {
    const convs: Conversation[] = [];
    if (this.isClient() && this.professionals?.length > 0) {
      this.professionals.forEach((p: any) => {
        convs.push({
          otherUserId: p.id,
          otherUserName: p.fullName,
          otherUserRole: p.role === 'PERSONAL_TRAINER' ? 'Personal Trainer' : 'Nutrizionista',
          lastMessage: undefined,
          lastMessageTime: undefined,
          unreadCount: 0
        });
      });
    }
    if (this.isProfessional() && this.myClients?.length > 0) {
      this.myClients.forEach((c: any) => {
        convs.push({
          otherUserId: c.id,
          otherUserName: `${c.firstName} ${c.lastName}`,
          otherUserRole: 'Cliente',
          lastMessage: undefined,
          lastMessageTime: undefined,
          unreadCount: 0
        });
      });
    }
    return convs;
  }

  openConversation(conv: Conversation): void {
    this.activeConversation = conv;
    this.chatView = 'conversation';
    this.chatMessages = [];
    this.chatLoading = true;

    // Carica messaggi tra me e l'altro utente
    this.chatService.getMessages(this.currentUser.id, conv.otherUserId).subscribe({
      next: (msgs) => {
        this.chatMessages = msgs;
        this.chatLoading = false;
        this.cdr.detectChanges();
        setTimeout(() => this.scrollToBottom(), 50);
      },
      error: () => {
        this.chatLoading = false;
        this.cdr.detectChanges();
      }
    });

    // Segna come letti (io sono il receiver, l'altro è il sender)
    this.chatService.markAsRead(this.currentUser.id, conv.otherUserId).subscribe();
    conv.unreadCount = 0;

    // Avvia polling per aggiornamenti in tempo reale
    this.chatService.startPolling(this.currentUser.id, conv.otherUserId);
    this.chatService.messages$.subscribe(msgs => {
      if (msgs.length > 0) {
        this.chatMessages = msgs;
        this.cdr.detectChanges();
        this.scrollToBottom();
      }
    });
  }

  sendChatMessage(): void {
    const text = this.chatInput.trim();
    if (!text || !this.activeConversation) return;

    const receiverId = this.activeConversation.otherUserId;

    // Aggiunge messaggio localmente subito (UI ottimistica)
    const localMsg: ChatMessage = {
      id: Date.now(),
      senderId: this.currentUser.id,
      senderName: `${this.currentUser.firstName} ${this.currentUser.lastName}`,
      receiverId: receiverId,
      receiverName: this.activeConversation.otherUserName,
      content: text,
      status: 'SENT',
      createdAt: new Date().toISOString()
    };
    this.chatMessages = [...this.chatMessages, localMsg];
    this.chatInput = '';
    this.cdr.detectChanges();
    this.scrollToBottom();

    // Aggiorna preview nella lista conversazioni
    if (this.activeConversation) {
      this.activeConversation.lastMessage = text;
      this.activeConversation.lastMessageTime = localMsg.createdAt;
    }

    // Invia al backend
    this.chatService.sendMessage({
      senderId: this.currentUser.id,
      receiverId: receiverId,
      content: text
    }).subscribe({
      next: (savedMsg) => {
        // Sostituisci il messaggio locale con quello del server
        this.chatMessages = this.chatMessages.map(m =>
          m.id === localMsg.id ? savedMsg : m
        );
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.warn('Errore invio messaggio, resta in locale', err);
      }
    });
  }

  backToConversations(): void {
    this.chatView = 'list';
    this.activeConversation = null;
    this.chatMessages = [];
    this.chatService.clearMessages();
    this.chatService.stopPolling();
    this.loadConversations();
  }

  isMyMessage(msg: ChatMessage): boolean {
    return msg.senderId === this.currentUser?.id;
  }

  formatChatTime(isoString: string): string {
    if (!isoString) return '';
    const d = new Date(isoString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    if (isToday) return time;
    if (isYesterday) return `Ieri ${time}`;
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) + ` ${time}`;
  }

  formatConvTime(isoString?: string): string {
    if (!isoString) return '';
    const d = new Date(isoString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Ieri';
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  }

  getConversationInitials(conv: Conversation): string {
    const parts = conv.otherUserName.split(' ');
    return parts.map(p => p.charAt(0)).join('').substring(0, 2).toUpperCase();
  }

  getTotalUnread(): number {
    return this.chatConversations.reduce((sum, c) => sum + c.unreadCount, 0);
  }

  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        const el = this.messagesContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    } catch (e) {}
  }

  autoGrow(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  onChatKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendChatMessage();
    }
  }

  // ── Logout ───────────────────────────────────────────────

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
