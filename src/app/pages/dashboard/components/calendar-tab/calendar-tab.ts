import { Component, Input, Output, EventEmitter, HostListener, ChangeDetectorRef, inject, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-calendar-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar-tab.html',
  styleUrls: ['./calendar-tab.css'],
  encapsulation: ViewEncapsulation.None
})
export class CalendarTabComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);

  @Input() bookings: any[] = [];
  @Input() isProfessional: boolean = false;
  @Input() isClient: boolean = false;
  @Input() isLoading: boolean = false;
  @Output() openCallModalEvent = new EventEmitter<any>();
  @Output() openAvailabilityEvent = new EventEmitter<void>();

  currentWeekStart: Date = new Date();
  weekDays: Date[] = [];
  timeSlots: string[] = [];
  readonly START_HOUR = 8;
  readonly END_HOUR = 21;
  visibleDayCount: number = 7;
  dayOffset: number = 0;
  agendaView: boolean = false;

  ngOnInit(): void {
    this.initWeek();
    this.buildTimeSlots();
    this.updateVisibleDays();
    if (this.visibleDayCount < 7) {
      this.goToToday();
    }
  }

  @HostListener('window:resize')
  onResize(): void { this.updateVisibleDays(); this.cdr.detectChanges(); }

  updateVisibleDays(): void {
    const w = window.innerWidth;
    this.visibleDayCount = w < 1024 ? 3 : 7;
    this.buildWeekDays();
  }

  toggleAgendaView(): void { this.agendaView = !this.agendaView; }

  getAgendaDays(): Date[] {
    const days: Date[] = []; const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 30; i++) { const d = new Date(today); d.setDate(today.getDate() + i); if (this.getBookingsForAgendaDay(d).length > 0 || i < 3) days.push(d); }
    return days;
  }

  getBookingsForAgendaDay(day: Date): any[] {
    const dateStr = this.formatDate(day);
    return (this.bookings || []).filter((b: any) => b.date === dateStr).sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || ''));
  }

  initWeek(): void {
    const today = new Date(); const day = today.getDay(); const diff = day === 0 ? -6 : 1 - day;
    this.currentWeekStart = new Date(today); this.currentWeekStart.setDate(today.getDate() + diff); this.currentWeekStart.setHours(0, 0, 0, 0);
    this.dayOffset = 0; this.buildWeekDays();
  }

  buildWeekDays(): void {
    this.weekDays = [];
    for (let i = 0; i < (this.visibleDayCount || 7); i++) { const d = new Date(this.currentWeekStart); d.setDate(this.currentWeekStart.getDate() + this.dayOffset + i); this.weekDays.push(d); }
  }

  buildTimeSlots(): void {
    this.timeSlots = [];
    for (let h = this.START_HOUR; h < this.END_HOUR; h++) { this.timeSlots.push(`${h.toString().padStart(2, '0')}:00`); this.timeSlots.push(`${h.toString().padStart(2, '0')}:30`); }
  }

  isFullHour(slot: string): boolean { return slot.endsWith(':00'); }

  prevWeek(): void {
    if (this.visibleDayCount === 7) { const d = new Date(this.currentWeekStart); d.setDate(d.getDate() - 7); this.currentWeekStart = d; this.dayOffset = 0; }
    else { this.dayOffset -= this.visibleDayCount; if (this.dayOffset < -28) this.dayOffset = -28; }
    this.buildWeekDays();
  }

  nextWeek(): void {
    if (this.visibleDayCount === 7) { const d = new Date(this.currentWeekStart); d.setDate(d.getDate() + 7); this.currentWeekStart = d; this.dayOffset = 0; }
    else { this.dayOffset += this.visibleDayCount; if (this.dayOffset > 56) this.dayOffset = 56; }
    this.buildWeekDays();
  }

  goToToday(): void {
    this.initWeek(); this.updateVisibleDays();
    if (this.visibleDayCount < 7) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const diffDays = Math.round((today.getTime() - this.currentWeekStart.getTime()) / (1000 * 60 * 60 * 24));
      this.dayOffset = Math.floor(diffDays / this.visibleDayCount) * this.visibleDayCount;
      this.buildWeekDays();
    }
  }

  isToday(date: Date): boolean { return date.toDateString() === new Date().toDateString(); }

  getWeekLabel(): string {
    if (this.weekDays.length === 0) return '';
    const first = this.weekDays[0]; const last = this.weekDays[this.weekDays.length - 1];
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    if (this.visibleDayCount === 1) return first.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
    if (this.visibleDayCount === 3) return `${first.toLocaleDateString('it-IT', opts)} – ${last.toLocaleDateString('it-IT', opts)}`;
    const optsLong: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
    return `${first.toLocaleDateString('it-IT', optsLong)} – ${last.toLocaleDateString('it-IT', { ...optsLong, year: 'numeric' })}`;
  }

  formatDate(date: Date): string { const y = date.getFullYear(); const m = (date.getMonth() + 1).toString().padStart(2, '0'); const d = date.getDate().toString().padStart(2, '0'); return `${y}-${m}-${d}`; }
  getDayName(date: Date): string { return date.toLocaleDateString('it-IT', { weekday: 'short' }).toUpperCase(); }
  getDayNumber(date: Date): number { return date.getDate(); }
  getMonthShort(date: Date): string { return date.toLocaleDateString('it-IT', { month: 'short' }).replace('.', ''); }

  getBookingsForSlot(day: Date, timeSlot: string): any[] {
    const dateStr = this.formatDate(day); const [slotH, slotM] = timeSlot.split(':').map(Number);
    return this.bookings.filter(b => { if (b.date !== dateStr) return false; const [bH, bM] = (b.startTime ?? '00:00').split(':').map(Number); return bH === slotH && bM === slotM; });
  }

  getBookingLabel(b: any): string {
    if (this.isClient) { const role = b.professionalRole === 'PERSONAL_TRAINER' ? 'PT' : 'Nutr.'; return `${role} – ${b.professionalName ?? ''}`; }
    return b.clientName ?? '';
  }

  getBookingClass(b: any): string {
    if (b.status === 'CANCELLED') return 'booking-cancelled';
    if (b.professionalRole === 'NUTRITIONIST') return 'booking-nutrition';
    return 'booking-pt';
  }

  countWeekBookings(): number {
    return this.weekDays.reduce((acc, day) => acc + this.bookings.filter(b => b.date === this.formatDate(day)).length, 0);
  }
}
