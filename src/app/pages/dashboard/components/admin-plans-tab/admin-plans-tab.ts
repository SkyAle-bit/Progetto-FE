import { Component, Input, Output, EventEmitter, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../services/auth.service';
import { ToastService } from '../../../../services/toast.service';
@Component({ selector: 'app-admin-plans-tab', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './admin-plans-tab.html', styleUrls: ['./admin-plans-tab.css'] })
export class AdminPlansTabComponent {
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private toast = inject(ToastService);
  @Input() allPlans: any[] = [];
  @Input() allSubscriptions: any[] = [];
  @Output() plansChanged = new EventEmitter<void>();
  // Modale creazione piano
  showCreateModal: boolean = false;
  newPlan = { name: '', duration: 'SEMESTRALE', fullPrice: 0, monthlyInstallmentPrice: 0, monthlyCreditsPT: 0, monthlyCreditsNutri: 0 };
  createError: string = '';
  creating: boolean = false;
  getActiveSubsForPlan(planName: string): number { return this.allSubscriptions.filter(s => s.active && s.planName === planName).length; }
  getTotalSubsForPlan(planName: string): number { return this.allSubscriptions.filter(s => s.planName === planName).length; }
  getDurationLabel(duration: string): string { switch (duration) { case 'SEMESTRALE': return '6 mesi'; case 'ANNUALE': return '12 mesi'; default: return duration; } }
  canDeletePlan(plan: any): boolean { return this.getTotalSubsForPlan(plan.name) === 0; }
  openCreateModal(): void {
    this.newPlan = { name: '', duration: 'SEMESTRALE', fullPrice: 0, monthlyInstallmentPrice: 0, monthlyCreditsPT: 0, monthlyCreditsNutri: 0 };
    this.createError = '';
    this.showCreateModal = true;
  }
  closeCreateModal(): void { this.showCreateModal = false; }

  get durationMonths(): number {
    return this.newPlan.duration === 'ANNUALE' ? 12 : 6;
  }

  onFullPriceChange(): void {
    if (this.newPlan.fullPrice > 0) {
      this.newPlan.monthlyInstallmentPrice = Math.round((this.newPlan.fullPrice / this.durationMonths) * 100) / 100;
    }
  }

  onMonthlyPriceChange(): void {
    if (this.newPlan.monthlyInstallmentPrice > 0) {
      this.newPlan.fullPrice = Math.round((this.newPlan.monthlyInstallmentPrice * this.durationMonths) * 100) / 100;
    }
  }

  onDurationChange(): void {
    // Ricalcola la rata mensile partendo dal prezzo totale (se presente)
    if (this.newPlan.fullPrice > 0) {
      this.newPlan.monthlyInstallmentPrice = Math.round((this.newPlan.fullPrice / this.durationMonths) * 100) / 100;
    } else if (this.newPlan.monthlyInstallmentPrice > 0) {
      this.newPlan.fullPrice = Math.round((this.newPlan.monthlyInstallmentPrice * this.durationMonths) * 100) / 100;
    }
  }

  createPlan(): void {
    if (!this.newPlan.name || !this.newPlan.fullPrice || !this.newPlan.monthlyInstallmentPrice) {
      this.createError = 'Nome, prezzo totale e prezzo mensile sono obbligatori';
      return;
    }
    this.creating = true;
    this.createError = '';
    this.authService.createPlan(this.newPlan).subscribe({
      next: () => {
        this.creating = false;
        this.showCreateModal = false;
        this.toast.success('Piano Creato', `Il piano "${this.newPlan.name}" è stato creato con successo.`);
        this.plansChanged.emit();
      },
      error: (err) => {
        this.creating = false;
        this.createError = err.error?.error || 'Errore nella creazione';
        this.cdr.detectChanges();
      }
    });
  }
  deletePlan(plan: any): void {
    if (!confirm(`Eliminare il piano "${plan.name}"?`)) return;
    this.authService.deletePlan(plan.id).subscribe({
      next: () => { this.toast.success('Eliminato', 'Piano eliminato con successo.'); this.plansChanged.emit(); },
      error: (err) => { this.toast.error('Errore', err.error?.error || 'Impossibile eliminare il piano'); }
    });
  }
}
