import { Component, Input, Output, EventEmitter, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../services/auth.service';

@Component({
  selector: 'app-admin-users-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-users-tab.html',
  styleUrls: ['./admin-users-tab.css']
})
export class AdminUsersTabComponent {
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  @Input() allUsers: any[] = [];
  @Input() allPlans: any[] = [];
  @Output() usersChanged = new EventEmitter<void>();

  searchQuery: string = '';
  roleFilter: string = 'ALL';

  // Modale creazione utente
  showCreateModal: boolean = false;
  currentStep: number = 1; // step wizard: 1=dati base, 2=piano+professionisti (solo CLIENT)
  newUser: any = { firstName: '', lastName: '', email: '', password: '', role: 'CLIENT', planId: null, assignedPTId: null, assignedNutritionistId: null };
  createError: string = '';
  creating: boolean = false;

  get filteredUsers(): any[] {
    let users = this.allUsers;
    if (this.roleFilter !== 'ALL') {
      users = users.filter(u => u.role === this.roleFilter);
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      users = users.filter(u =>
        (u.firstName + ' ' + u.lastName).toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
      );
    }
    return users;
  }

  get availablePTs(): any[] {
    return this.allUsers.filter(u => u.role === 'PERSONAL_TRAINER');
  }

  get availableNutritionists(): any[] {
    return this.allUsers.filter(u => u.role === 'NUTRITIONIST');
  }

  get isClientRole(): boolean {
    return this.newUser.role === 'CLIENT';
  }

  get totalSteps(): number {
    return this.isClientRole ? 2 : 1;
  }

  openCreateModal(): void {
    this.newUser = { firstName: '', lastName: '', email: '', password: '', role: 'CLIENT', planId: null, assignedPTId: null, assignedNutritionistId: null };
    this.createError = '';
    this.currentStep = 1;
    this.showCreateModal = true;
  }

  closeCreateModal(): void { this.showCreateModal = false; }

  nextStep(): void {
    if (!this.newUser.firstName || !this.newUser.lastName || !this.newUser.email || !this.newUser.password) {
      this.createError = 'Tutti i campi sono obbligatori';
      return;
    }
    this.createError = '';
    if (this.isClientRole && this.currentStep < this.totalSteps) {
      this.currentStep = 2;
    } else {
      this.createUser();
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.createError = '';
    }
  }

  createUser(): void {
    if (this.isClientRole && (!this.newUser.planId || !this.newUser.assignedPTId || !this.newUser.assignedNutritionistId)) {
      this.createError = 'Seleziona Piano, Personal Trainer e Nutrizionista';
      return;
    }
    this.creating = true;
    this.createError = '';

    const payload: any = {
      firstName: this.newUser.firstName,
      lastName: this.newUser.lastName,
      email: this.newUser.email,
      password: this.newUser.password,
      role: this.newUser.role
    };

    if (this.isClientRole) {
      if (this.newUser.planId) payload.planId = this.newUser.planId;
      if (this.newUser.assignedPTId) payload.assignedPTId = this.newUser.assignedPTId;
      if (this.newUser.assignedNutritionistId) payload.assignedNutritionistId = this.newUser.assignedNutritionistId;
    }

    this.authService.createUser(payload).subscribe({
      next: () => {
        this.creating = false;
        this.showCreateModal = false;
        this.usersChanged.emit();
      },
      error: (err) => {
        this.creating = false;
        this.createError = err.error?.error || 'Errore nella creazione';
        this.cdr.detectChanges();
      }
    });
  }

  deleteUser(user: any): void {
    if (!confirm(`Eliminare l'utente ${user.firstName} ${user.lastName}?`)) return;
    this.authService.deleteUser(user.id).subscribe({
      next: () => { this.usersChanged.emit(); },
      error: (err) => { alert(err.error?.error || 'Errore nell\'eliminazione'); }
    });
  }

  getRoleLabel(role: string): string {
    switch (role) {
      case 'CLIENT': return 'Cliente';
      case 'PERSONAL_TRAINER': return 'Personal Trainer';
      case 'NUTRITIONIST': return 'Nutrizionista';
      case 'ADMIN': return 'Admin';
      case 'INSURANCE_MANAGER': return 'Assicurazione';
      default: return role;
    }
  }

  getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'CLIENT': return 'bg-blue-50 text-blue-600';
      case 'PERSONAL_TRAINER': return 'bg-emerald-50 text-emerald-600';
      case 'NUTRITIONIST': return 'bg-amber-50 text-amber-700';
      case 'ADMIN': return 'bg-purple-50 text-purple-600';
      case 'INSURANCE_MANAGER': return 'bg-indigo-50 text-indigo-600';
      default: return 'bg-gray-50 text-gray-600';
    }
  }

  getRoleEmoji(role: string): string {
    switch (role) {
      case 'CLIENT': return '🧑';
      case 'PERSONAL_TRAINER': return '💪';
      case 'NUTRITIONIST': return '🥗';
      case 'ADMIN': return '🛡️';
      case 'INSURANCE_MANAGER': return '📋';
      default: return '👤';
    }
  }

  getSelectedPlanName(): string {
    if (!this.newUser.planId) return 'Non selezionato';
    const plan = this.allPlans.find(p => p.id === this.newUser.planId);
    return plan?.name ?? 'Non selezionato';
  }
  getSelectedPTName(): string {
    if (!this.newUser.assignedPTId) return 'Non selezionato';
    const pt = this.allUsers.find(u => u.id === this.newUser.assignedPTId);
    return pt ? `${pt.firstName} ${pt.lastName}` : 'Non selezionato';
  }
  getSelectedNutriName(): string {
    if (!this.newUser.assignedNutritionistId) return 'Non selezionato';
    const n = this.allUsers.find(u => u.id === this.newUser.assignedNutritionistId);
    return n ? `${n.firstName} ${n.lastName}` : 'Non selezionato';
  }
}
