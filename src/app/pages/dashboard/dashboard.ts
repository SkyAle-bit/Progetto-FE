import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  currentUser: any = null;
  dashboardData: any = null;
  isLoading: boolean = true;
  isProfileOpen: boolean = false;

  currentWeekStart: Date = new Date();
  weekDays: Date[] = [];
  timeSlots: string[] = [];
  readonly START_HOUR = 8;
  readonly END_HOUR = 21;

  // Responsive: quanti giorni mostrare in base alla larghezza schermo
  visibleDayCount: number = 7;

  // Offset del "giorno di partenza" nella vista (per mobile: scorre di 1, tablet: di 3)
  dayOffset: number = 0;

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

  ngOnDestroy(): void {}

  // ── Responsive ───────────────────────────────────────────

  @HostListener('window:resize')
  onResize(): void {
    this.updateVisibleDays();
    this.cdr.detectChanges();
  }

  updateVisibleDays(): void {
    const w = window.innerWidth;
    if (w <= 640) {
      this.visibleDayCount = 1;
    } else if (w <= 1024) {
      this.visibleDayCount = 3;
    } else {
      this.visibleDayCount = 7;
    }
    // Ricalcola i giorni visibili
    this.buildWeekDays();
  }

  // ── Caricamento dati ─────────────────────────────────────

  loadDashboardData(): void {
    this.authService.getDashboard(this.currentUser.id).subscribe({
      next: (data) => {
        this.dashboardData = data;
        this.isLoading = false;
        this.cdr.detectChanges();
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
      // Desktop: settimana precedente
      const d = new Date(this.currentWeekStart);
      d.setDate(d.getDate() - 7);
      this.currentWeekStart = d;
      this.dayOffset = 0;
    } else {
      // Tablet/mobile: scorre indietro di N giorni
      this.dayOffset -= this.visibleDayCount;
      // Evita di andare troppo indietro (limite: 4 settimane fa)
      const minOffset = -28;
      if (this.dayOffset < minOffset) this.dayOffset = minOffset;
    }
    this.buildWeekDays();
  }

  nextWeek(): void {
    if (this.visibleDayCount === 7) {
      // Desktop: settimana successiva
      const d = new Date(this.currentWeekStart);
      d.setDate(d.getDate() + 7);
      this.currentWeekStart = d;
      this.dayOffset = 0;
    } else {
      // Tablet/mobile: scorre avanti di N giorni
      this.dayOffset += this.visibleDayCount;
      // Limite: 8 settimane avanti
      const maxOffset = 56;
      if (this.dayOffset > maxOffset) this.dayOffset = maxOffset;
    }
    this.buildWeekDays();
  }

  goToToday(): void {
    this.initWeek();
    this.updateVisibleDays();
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
      // Su mobile: mostra solo "Ven 20 Feb"
      return first.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
    }
    if (this.visibleDayCount === 3) {
      return `${first.toLocaleDateString('it-IT', opts)} – ${last.toLocaleDateString('it-IT', opts)}`;
    }
    // Desktop: "20 febbraio – 26 febbraio 2026"
    const optsLong: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
    return `${first.toLocaleDateString('it-IT', optsLong)} – ${last.toLocaleDateString('it-IT', { ...optsLong, year: 'numeric' })}`;
  }

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

  // ── Logout ───────────────────────────────────────────────

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
