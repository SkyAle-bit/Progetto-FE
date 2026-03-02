import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home-tab.html',
  styleUrls: ['./home-tab.css']
})
export class HomeTabComponent {
  @Input() currentUser: any;
  @Input() profile: any;
  @Input() subscription: any;
  @Input() bookings: any[] = [];
  @Input() myClients: any[] = [];
  @Input() professionals: any[] = [];
  @Input() isProfessional: boolean = false;
  @Input() isClient: boolean = false;
  @Input() weekBookingsCount: number = 0;

  @Output() openAvailabilityEvent = new EventEmitter<void>();
  @Output() setTabEvent = new EventEmitter<string>();

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

  toDate(dateStr: string): Date { return new Date(dateStr + 'T00:00:00'); }
  getDayNumber(date: Date): number { return date.getDate(); }
  getMonthShort(date: Date): string { return date.toLocaleDateString('it-IT', { month: 'short' }).replace('.', ''); }

  getBookingLabel(b: any): string {
    if (this.isClient) {
      const role = b.professionalRole === 'PERSONAL_TRAINER' ? 'PT' : 'Nutr.';
      return `${role} – ${b.professionalName ?? ''}`;
    }
    return b.clientName ?? '';
  }
}
