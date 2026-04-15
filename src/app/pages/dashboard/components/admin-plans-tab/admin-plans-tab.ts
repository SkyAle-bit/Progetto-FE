import { Component, Input, Output, EventEmitter, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlanService } from '../../../../services/plan.service';
import { ToastService } from '../../../../services/toast.service';
@Component({ selector: 'app-admin-plans-tab', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './admin-plans-tab.html', styleUrls: ['./admin-plans-tab.css'] })
export class AdminPlansTabComponent {
  private authService = inject(PlanService);
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

  // Modale modifica piano
  showEditModal: boolean = false;
  editPlan: any = {};
  editError: string = '';
  editing: boolean = false;

  // Modale conferma eliminazione
  showDeleteModal: boolean = false;
  planToDelete: any = null;
  deleting: boolean = false;

  getActiveSubsForPlan(planName: string): number { return this.allSubscriptions.filter(s => s.active && s.planName === planName).length; }
  getTotalSubsForPlan(planName: string): number { return this.allSubscriptions.filter(s => s.planName === planName).length; }
  getDurationLabel(duration: string): string { switch (duration) { case 'SEMESTRALE': return '6 mesi'; case 'ANNUALE': return '12 mesi'; default: return duration; } }
  canDeletePlan(plan: any): boolean { return this.getTotalSubsForPlan(plan.name) === 0; }

  // ── Create ──
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

  // ── Edit ──
  openEditModal(plan: any): void {
    this.editPlan = { ...plan };
    this.editError = '';
    this.showEditModal = true;
  }
  closeEditModal(): void { this.showEditModal = false; }

  get editDurationMonths(): number {
    return this.editPlan.duration === 'ANNUALE' ? 12 : 6;
  }

  onEditFullPriceChange(): void {
    if (this.editPlan.fullPrice > 0) {
      this.editPlan.monthlyInstallmentPrice = Math.round((this.editPlan.fullPrice / this.editDurationMonths) * 100) / 100;
    }
  }

  onEditMonthlyPriceChange(): void {
    if (this.editPlan.monthlyInstallmentPrice > 0) {
      this.editPlan.fullPrice = Math.round((this.editPlan.monthlyInstallmentPrice * this.editDurationMonths) * 100) / 100;
    }
  }

  onEditDurationChange(): void {
    if (this.editPlan.fullPrice > 0) {
      this.editPlan.monthlyInstallmentPrice = Math.round((this.editPlan.fullPrice / this.editDurationMonths) * 100) / 100;
    } else if (this.editPlan.monthlyInstallmentPrice > 0) {
      this.editPlan.fullPrice = Math.round((this.editPlan.monthlyInstallmentPrice * this.editDurationMonths) * 100) / 100;
    }
  }

  saveEditPlan(): void {
    if (!this.editPlan.name || !this.editPlan.fullPrice || !this.editPlan.monthlyInstallmentPrice) {
      this.editError = 'Nome, prezzo totale e prezzo mensile sono obbligatori';
      return;
    }
    this.editing = true;
    this.editError = '';
    this.authService.updatePlan(this.editPlan.id, this.editPlan).subscribe({
      next: () => {
        this.editing = false;
        this.showEditModal = false;
        this.toast.success('Piano Aggiornato', `Il piano "${this.editPlan.name}" è stato aggiornato.`);
        this.plansChanged.emit();
      },
      error: (err) => {
        this.editing = false;
        this.editError = err.error?.error || 'Errore nell\'aggiornamento';
        this.cdr.detectChanges();
      }
    });
  }

  // ── Delete (styled modal) ──
  openDeleteModal(plan: any): void {
    this.planToDelete = plan;
    this.showDeleteModal = true;
  }
  closeDeleteModal(): void { this.showDeleteModal = false; this.planToDelete = null; }

  confirmDeletePlan(): void {
    if (!this.planToDelete) return;
    this.deleting = true;
    this.authService.deletePlan(this.planToDelete.id).subscribe({
      next: () => {
        this.deleting = false;
        this.showDeleteModal = false;
        this.toast.success('Eliminato', 'Piano eliminato con successo.');
        this.planToDelete = null;
        this.plansChanged.emit();
      },
      error: (err) => {
        this.deleting = false;
        this.showDeleteModal = false;
        this.toast.error('Errore', err.error?.error || 'Impossibile eliminare il piano');
        this.planToDelete = null;
      }
    });
  }
}
