import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
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
export class DashboardComponent implements OnInit {
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

  ngOnInit(): void {
    const userString = localStorage.getItem('user');
    if (userString) {
      this.currentUser = JSON.parse(userString);
      this.initWeek();
      this.buildTimeSlots();
      this.loadDashboardData();
    } else {
      this.router.navigate(['/login']);
    }
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
    this.buildWeekDays();
  }

  buildWeekDays(): void {
    this.weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(this.currentWeekStart);
      d.setDate(this.currentWeekStart.getDate() + i);
      this.weekDays.push(d);
    }
  }

  // Slot ogni 30 minuti: "08:00", "08:30", "09:00", ...
  buildTimeSlots(): void {
    this.timeSlots = [];
    for (let h = this.START_HOUR; h < this.END_HOUR; h++) {
      this.timeSlots.push(`${h.toString().padStart(2, '0')}:00`);
      this.timeSlots.push(`${h.toString().padStart(2, '0')}:30`);
    }
  }

  // Mostra l'etichetta solo sugli slot "esatti" (:00), non sui :30
  isFullHour(slot: string): boolean {
    return slot.endsWith(':00');
  }

  prevWeek(): void {
    const d = new Date(this.currentWeekStart);
    d.setDate(d.getDate() - 7);
    this.currentWeekStart = d;
    this.buildWeekDays();
  }

  nextWeek(): void {
    const d = new Date(this.currentWeekStart);
    d.setDate(d.getDate() + 7);
    this.currentWeekStart = d;
    this.buildWeekDays();
  }

  goToToday(): void { this.initWeek(); }

  isToday(date: Date): boolean {
    return date.toDateString() === new Date().toDateString();
  }

  getWeekLabel(): string {
    const end = new Date(this.currentWeekStart);
    end.setDate(end.getDate() + 6);
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
    return `${this.currentWeekStart.toLocaleDateString('it-IT', opts)} – ${end.toLocaleDateString('it-IT', { ...opts, year: 'numeric' })}`;
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

  // Filtra le prenotazioni per giorno e slot da 30 minuti esatto
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
      return `${role} – ${b.professionalName ?? ''}`;  // usa professionalName
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
