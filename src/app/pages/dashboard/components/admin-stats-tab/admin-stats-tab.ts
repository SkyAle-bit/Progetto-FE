import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../../../services/user.service';

@Component({
  selector: 'app-admin-stats-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-stats-tab.html',
  styleUrls: ['./admin-stats-tab.css']
})
export class AdminStatsTabComponent implements OnInit {
  private authService = inject(UserService);
  private cdr = inject(ChangeDetectorRef);

  stats: any = null;
  loading = true;

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.loading = true;
    this.authService.getAdminStats().subscribe({
      next: (data) => {
        this.stats = data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  getRoleLabel(role: string): string {
    switch (role) {
      case 'CLIENT': return 'Clienti';
      case 'PERSONAL_TRAINER': return 'Personal Trainer';
      case 'NUTRITIONIST': return 'Nutrizionisti';
      case 'ADMIN': return 'Admin';
      case 'INSURANCE_MANAGER': return 'Assicurazione';
      default: return role;
    }
  }

  getRoleColor(role: string): string {
    switch (role) {
      case 'CLIENT': return '#2d5fa8';
      case 'PERSONAL_TRAINER': return '#059669';
      case 'NUTRITIONIST': return 'var(--color-accent-gold)';
      case 'ADMIN': return '#7c3aed';
      case 'INSURANCE_MANAGER': return '#4f46e5';
      default: return 'var(--color-text-muted)';
    }
  }

  getMaxMonthCount(): number {
    if (!this.stats?.usersPerMonth) return 1;
    return Math.max(1, ...this.stats.usersPerMonth.map((m: any) => m.count));
  }

  getBarHeight(count: number): number {
    return Math.max(4, (count / this.getMaxMonthCount()) * 100);
  }

  getProRoleLabel(role: string): string {
    return role === 'PERSONAL_TRAINER' ? 'PT' : 'Nutri';
  }

  getProRoleColor(role: string): string {
    return role === 'PERSONAL_TRAINER' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-700';
  }
}

