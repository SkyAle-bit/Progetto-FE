import {
  Component, inject, OnInit, OnDestroy, ChangeDetectorRef, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { HomeTabComponent } from './components/home-tab/home-tab';
import { CalendarTabComponent } from './components/calendar-tab/calendar-tab';
import { ChatTabComponent } from './components/chat-tab/chat-tab';
import { ClientsTabComponent } from './components/clients-tab/clients-tab';
import { AdminHomeTabComponent } from './components/admin-home-tab/admin-home-tab';
import { AdminUsersTabComponent } from './components/admin-users-tab/admin-users-tab';
import { AdminPlansTabComponent } from './components/admin-plans-tab/admin-plans-tab';
import { InsuranceHomeTabComponent } from './components/insurance-home-tab/insurance-home-tab';
import { MyProfessionalsTabComponent } from './components/my-professionals-tab/my-professionals-tab';
import { MyServicesTabComponent } from './components/my-services-tab/my-services-tab';
import { AdminStatsTabComponent } from './components/admin-stats-tab/admin-stats-tab';
import { ToastComponent } from '../../components/toast/toast';
import { ToastService } from '../../services/toast.service';
import { PullToRefreshDirective } from '../../directives/pull-to-refresh.directive';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, HomeTabComponent, CalendarTabComponent, ChatTabComponent, ClientsTabComponent, AdminHomeTabComponent, AdminUsersTabComponent, AdminPlansTabComponent, InsuranceHomeTabComponent, MyProfessionalsTabComponent, MyServicesTabComponent, AdminStatsTabComponent, ToastComponent, PullToRefreshDirective],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private chatService = inject(ChatService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private toast = inject(ToastService);

  currentUser: any = null;
  dashboardData: any = null;
  isLoading: boolean = true;
  isProfileOpen: boolean = false;
  myClients: any[] = []; // Array per la quick view nel profilo

  // ── Admin / Insurance data ────────────────────────────────
  allUsers: any[] = [];
  allPlans: any[] = [];
  allSubscriptions: any[] = [];

  // ── Tab mobile ────────────────────────────────────────────
  activeTab: string = 'home'; // 'home' | 'calendar' | 'chat' | 'clients' | 'professionals'

  // ── Chat (solo badge globale) ───────────────────────────
  globalUnreadCount: number = 0;

  // ── Statistiche professionista ─────────────────────────
  proStats: any = null;

  // ── Cronologia attività ────────────────────────────────
  activityFeed: any[] = [];

  // ── Modale Successo Globale ───────────────────────────────
  isPopupOpen: boolean = false;
  popupTitle: string = '';
  popupMessage: string = '';

  openPopup(title: string, message: string): void {
    this.popupTitle = title;
    this.popupMessage = message;
    this.isPopupOpen = true;
  }

  showPopupMessage(title: string, message: string): void {
    // Determina il tipo di toast dal titolo
    const t = title.toLowerCase();
    if (t.includes('errore') || t.includes('error')) {
      this.toast.error(title, message);
    } else if (t.includes('attenzione') || t.includes('warning')) {
      this.toast.warning(title, message);
    } else {
      this.toast.success(title, message);
    }
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

      // Inizializza chat real-time (WebSocket + polling fallback)
      this.chatService.init(this.currentUser.id);

      // Sottoscrizione al conteggio globale non letti
      this.chatService.unreadCount$.subscribe(count => {
        this.globalUnreadCount = count;
        this.cdr.detectChanges();
      });
    } else {
      this.router.navigate(['/login']);
    }
  }

  ngOnDestroy(): void {
    if (this.timeCheckInterval) {
      clearInterval(this.timeCheckInterval);
    }
    this.chatService.destroy();
  }

  // ── Responsive ───────────────────────────────────────────

  @HostListener('window:resize')
  onResize(): void {
    this.updateVisibleDays();
    this.cdr.detectChanges();
  }

  updateVisibleDays(): void {
    const w = window.innerWidth;
    if (w < 640) {
      this.visibleDayCount = 3;          // mobile
    } else if (w < 1024) {
      this.visibleDayCount = 3;          // tablet
    } else {
      this.visibleDayCount = 7;          // desktop
    }
    this.buildWeekDays();
  }

  // ── Caricamento dati ─────────────────────────────────────

  loadDashboardData(): void {
    // Admin e Insurance Manager caricano dati diversi
    if (this.isAdmin() || this.isInsuranceManager()) {
      this.loadAdminInsuranceData();
      return;
    }

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
              // Carica statistiche professionista
              this.loadProStats();
              this.loadActivityFeed();
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
          this.loadActivityFeed();
        }
      },
      error: (err) => {
        console.error('Errore nel caricamento della dashboard', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private loadAdminInsuranceData(): void {
    let loaded = 0;
    const total = 3;
    const checkDone = () => { loaded++; if (loaded >= total) { this.isLoading = false; this.cdr.detectChanges(); } };

    this.authService.getAllUsers().subscribe({
      next: (users) => { this.allUsers = users ?? []; checkDone(); },
      error: () => { this.allUsers = []; checkDone(); }
    });
    this.authService.getPlans().subscribe({
      next: (plans) => { this.allPlans = plans ?? []; checkDone(); },
      error: () => { this.allPlans = []; checkDone(); }
    });
    this.authService.getAllSubscriptions().subscribe({
      next: (subs) => { this.allSubscriptions = subs ?? []; checkDone(); },
      error: () => { this.allSubscriptions = []; checkDone(); }
    });
  }

  reloadAdminData(): void {
    this.loadAdminInsuranceData();
  }

  private loadProStats(): void {
    if (!this.isProfessional() || !this.currentUser?.id) return;
    this.authService.getProfessionalStats(this.currentUser.id).subscribe({
      next: (stats) => {
        this.proStats = stats;
        this.cdr.detectChanges();
      },
      error: () => { /* silently ignore */ }
    });
  }

  // ── Cronologia Attività ──────────────────────────────────

  private loadActivityFeed(): void {
    if (!this.currentUser?.id) return;
    this.authService.getActivityFeed(this.currentUser.id).subscribe({
      next: (feed) => {
        this.activityFeed = feed || [];
        this.cdr.detectChanges();
      },
      error: () => { /* silently ignore */ }
    });
  }

  // ── Pull-to-Refresh ─────────────────────────────────────

  onPullRefresh(): void {
    if (this.isAdmin() || this.isInsuranceManager()) {
      this.loadAdminInsuranceData();
    } else {
      this.loadDashboardData();
    }
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
  isAdmin(): boolean { return this.currentUser?.role === 'ADMIN'; }
  isInsuranceManager(): boolean { return this.currentUser?.role === 'INSURANCE_MANAGER'; }

  setTab(tab: string): void {
    this.activeTab = tab;
    if (tab === 'chat') {
      this.globalUnreadCount = 0;
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

  formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  getDayName(date: Date): string {
    return date.toLocaleDateString('it-IT', { weekday: 'short' }).toUpperCase();
  }

  getDayNumber(date: Date): number { return date.getDate(); }

  getBookingLabel(b: any): string {
    if (this.isClient()) {
      const role = b.professionalRole === 'PERSONAL_TRAINER' ? 'PT' : 'Nutr.';
      return `${role} – ${b.professionalName ?? ''}`;
    }
    return b.clientName ?? '';
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
          if (!slot.isAvailable || slot.available === false) {
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
        this.toast.warning('Slot Prenotato', 'Questo slot è già stato prenotato da un cliente e non può essere rimosso.');
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
              this.toast.error('Errore', 'Impossibile rimuovere lo slot in questo momento.');
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
      this.toast.warning('Attenzione', 'Nessuno slot selezionato.');
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
        this.toast.success('Disponibilità Confermate', 'I tuoi slot sono stati salvati con successo. I clienti potranno ora prenotarli.');
        this.selectedSlots.clear();
        this.copiedDay = null;
        this.isLoading = false;
        this.closeAvailability();
        // Ricarica la dashboard per riflettere le modifiche (se la view mostra gli slot del prof)
        this.loadDashboardData();
      },
      error: (err) => {
        console.error('Errore salvataggio disponibilità', err);
        this.toast.error('Errore', 'Si è verificato un errore durante il salvataggio. Riprova più tardi.');
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
        this.availableBookingSlots = slots.filter((s: any) => s.available || s.isAvailable);
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
      next: () => {
        this.toast.success('Prenotazione Confermata', `Hai prenotato con successo un appuntamento per il ${this.selectedBookingDay?.toLocaleDateString('it-IT')} alle ${this.getSlotTimeLabel(this.selectedBookingSlot)}.`);
        this.closeBooking();
        this.loadDashboardData();
      },
      error: (err) => {
        console.error('Errore nella prenotazione', err);
        let errMsg = 'Errore durante la prenotazione';
        if (err.error && err.error.message) errMsg = err.error.message;
        else if (err.error && typeof err.error === 'string') errMsg = err.error;
        this.toast.error('Errore di Prenotazione', errMsg);
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


    // allow join se (startTime - now) <= 30 minuti
    this.canJoinCallNow = true;
  }

  joinCall(): void {
    if (!this.canJoinCallNow || !this.selectedCallBooking?.meetingLink) return;

    // Apri il link meeting in una nuova tab
    window.open(this.selectedCallBooking.meetingLink, '_blank');
    this.closeCallModal();
  }

  // ── Chat (solo badge notifiche nella topbar) ──────────────

  getTotalUnread(): number {
    return this.globalUnreadCount;
  }

  onNotificationBellClick(): void {
    this.globalUnreadCount = 0;
    this.setTab('chat');
  }


  // ── Logout ───────────────────────────────────────────────

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
