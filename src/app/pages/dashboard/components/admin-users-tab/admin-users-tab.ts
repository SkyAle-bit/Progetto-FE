import { Component, Input, Output, EventEmitter, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { UserService } from '../../../../services/user.service';
import { SubscriptionService } from '../../../../services/subscription.service';
import { ManagedUserPayload } from '../../../../models/dashboard.types';
import { ToastService } from '../../../../services/toast.service';

@Component({
  selector: 'app-admin-users-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-users-tab.html',
  styleUrls: ['./admin-users-tab.css']
})
export class AdminUsersTabComponent {
  private authService = inject(UserService);
  private subscriptionService = inject(SubscriptionService);
  private cdr = inject(ChangeDetectorRef);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  @Input() allUsers: any[] = [];
  @Input() allPlans: any[] = [];
  @Input() allSubscriptions: any[] = [];
  @Input() mode: 'admin' | 'moderator' = 'admin';
  @Input() currentUser: any = null;
  @Output() usersChanged = new EventEmitter<void>();

  searchQuery: string = '';
  roleFilter: string = 'ALL';
  showFilterDropdown: boolean = false;

  // Modale creazione utente
  showCreateModal: boolean = false;
  currentStep: number = 1;
  newUser: any = { firstName: '', lastName: '', email: '', password: '', role: 'CLIENT', planId: null, assignedPTId: null, assignedNutritionistId: null };
  createError: string = '';
  creating: boolean = false;
  showPassword: boolean = false;

  // Modale modifica utente
  showEditModal: boolean = false;
  editUser: any = {};
  editPassword: string = '';
  editError: string = '';
  editingUser: boolean = false;
  showEditPassword: boolean = false;

  // Modale cancellazione utente
  showDeleteModal: boolean = false;
  userToDelete: any = null;
  deletingUser: boolean = false;

  // Info Modal
  showInfoModal: boolean = false;
  selectedUserInfo: any = null;
  selectedSubscription: any = null;

  // Credits Modal
  showCreditsModal: boolean = false;
  updatingCredits: boolean = false;
  creditsForm = this.fb.group({
    creditsPT: [0, Validators.required],
    creditsNutri: [0, Validators.required]
  });

  private readonly moderatorAllowedRoles = ['CLIENT', 'PERSONAL_TRAINER', 'NUTRITIONIST'];

  private getErrorMessage(err: unknown, fallback: string): string {
    const e = err as { error?: { message?: string; error?: string }; message?: string };
    return e?.error?.message || e?.error?.error || e?.message || fallback;
  }

  isAdminMode(): boolean {
    return this.mode === 'admin';
  }

  canFilterRole(role: string): boolean {
    if (role === 'ALL') return true;
    return this.isAdminMode() || this.moderatorAllowedRoles.includes(role);
  }

  get creatableRoles(): string[] {
    return this.isAdminMode()
      ? ['CLIENT', 'PERSONAL_TRAINER', 'NUTRITIONIST', 'MODERATOR', 'INSURANCE_MANAGER']
      : this.moderatorAllowedRoles;
  }

  getFilterLabelPlural(role: string): string {
    switch (role) {
      case 'ALL': return 'Tutti i ruoli';
      case 'CLIENT': return 'Clienti';
      case 'PERSONAL_TRAINER': return 'Personal Trainer';
      case 'NUTRITIONIST': return 'Nutrizionisti';
      case 'ADMIN': return 'Amministratori';
      case 'MODERATOR': return 'Moderatori';
      case 'INSURANCE_MANAGER': return 'Assicuratori';
      default: return 'Tutti';
    }
  }

  // Filtra gli utenti in base alla query di ricerca e al filtro di ruolo
  get filteredUsers(): any[] {
    let users = this.allUsers;
    if (!this.canFilterRole(this.roleFilter)) {
      this.roleFilter = 'ALL';
    }
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
    this.showPassword = false;
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

    if (!this.isAdminMode() && !this.moderatorAllowedRoles.includes(this.newUser.role)) {
      this.creating = false;
      this.createError = 'Il moderatore puo creare solo clienti, personal trainer e nutrizionisti';
      return;
    }

    const payload: ManagedUserPayload = {
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

    this.authService.createUserByMode(this.mode, payload).subscribe({
      next: () => {
        this.creating = false;
        this.showCreateModal = false;
        this.toast.success('Utente Creato', `${this.newUser.firstName} ${this.newUser.lastName} e stato creato con successo.`);
        this.usersChanged.emit();
      },
      error: (err: unknown) => {
        this.creating = false;
        this.createError = this.getErrorMessage(err, 'Errore nella creazione');
        this.cdr.detectChanges();
      }
    });
  }

  // ── Delete user ──
  openDeleteModal(user: any): void {
    if (this.currentUser && user.id === this.currentUser.id) {
      this.toast.warning('Operazione non consentita', 'Non puoi eliminare il tuo stesso account.');
      return;
    }
    this.userToDelete = user;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.userToDelete = null;
    this.deletingUser = false;
  }

  confirmDeleteUser(): void {
    if (!this.userToDelete) return;
    this.deletingUser = true;

    this.authService.deleteUserByMode(this.mode, this.userToDelete.id).subscribe({
      next: () => {
        this.deletingUser = false;
        this.closeDeleteModal();
        this.toast.success('Eliminato', 'Utente eliminato con successo.');
        this.usersChanged.emit();
      },
      error: (err: unknown) => {
        this.deletingUser = false;
        this.closeDeleteModal();
        this.toast.error('Errore', this.getErrorMessage(err, 'Errore nell\'eliminazione'));
      }
    });
  }

  // ── Info e Crediti Abbonamento ──
  openInfoModal(user: any): void {
    this.selectedUserInfo = user;
    // Utilizziamo == invece di === per gestire eventuali mismatch tra stringa e numero (Long di Java)
    this.selectedSubscription = (this.allSubscriptions || []).find(s => s.userId == user.id && s.active);
    console.log('Opening Info Modal for user:', user.email, 'ID:', user.id);
    console.log('Active subscriptions count:', (this.allSubscriptions || []).length);
    console.log('Matched subscription:', this.selectedSubscription);
    this.showInfoModal = true;
  }

  closeInfoModal(): void {
    this.showInfoModal = false;
    this.selectedUserInfo = null;
    this.selectedSubscription = null;
  }

  openCreditsModal(user: any): void {
    const sub = this.allSubscriptions.find(s => s.userId === user.id && s.active);
    if (sub) {
      this.selectedSubscription = sub;
      this.creditsForm.patchValue({
        creditsPT: sub.currentCreditsPT || 0,
        creditsNutri: sub.currentCreditsNutri || 0
      });
      this.showCreditsModal = true;
    } else {
      this.toast.error('Ops', 'Questo utente non ha un abbonamento attivo.');
    }
  }

  closeCreditsModal(): void {
    this.showCreditsModal = false;
    this.selectedSubscription = null;
    this.creditsForm.reset();
  }

  saveCredits(): void {
    if (this.creditsForm.invalid || !this.selectedSubscription) return;
    this.updatingCredits = true;

    const pt = this.creditsForm.value.creditsPT || 0;
      const nutri = this.creditsForm.value.creditsNutri || 0;

      this.subscriptionService.updateSubscriptionCredits(this.mode, this.selectedSubscription.id, pt, nutri).subscribe({
        next: (res: any) => {
        this.updatingCredits = false;
        this.closeCreditsModal();
        this.toast.success('Fatto', 'Crediti aggiornati con successo.');

        this.selectedSubscription.currentCreditsPT = pt;
        this.selectedSubscription.currentCreditsNutri = nutri;
        this.usersChanged.emit();
      },
      error: (err: unknown) => {
        this.updatingCredits = false;
        this.toast.error('Errore', this.getErrorMessage(err, 'Errore nell\'aggiornamento crediti'));
      }
    });
  }

  // ── Edit user ──
  openEditModal(user: any): void {
    this.editUser = { ...user };
    this.editPassword = '';
    this.editError = '';
    this.showEditModal = true;
    this.showEditPassword = false;
  }

  closeEditModal(): void { this.showEditModal = false; }

  saveEditUser(): void {
    if (!this.editUser.firstName || !this.editUser.lastName || !this.editUser.email) {
      this.editError = 'Nome, cognome e email sono obbligatori';
      return;
    }
    this.editingUser = true;
    this.editError = '';
    const payload: any = {
      firstName: this.editUser.firstName,
      lastName: this.editUser.lastName,
      email: this.editUser.email,
    };
    if (this.editPassword.trim()) {
      payload.password = this.editPassword;
    }
    this.authService.updateUserByMode(this.mode, this.editUser.id, payload).subscribe({
      next: () => {
        this.editingUser = false;
        this.showEditModal = false;
        this.toast.success('Utente Aggiornato', `${this.editUser.firstName} ${this.editUser.lastName} aggiornato con successo.`);
        this.usersChanged.emit();
      },
      error: (err: unknown) => {
        this.editingUser = false;
        this.editError = this.getErrorMessage(err, 'Errore nell\'aggiornamento');
        this.cdr.detectChanges();
      }
    });
  }

  getRoleLabel(role: string): string {
    switch (role) {
      case 'CLIENT': return 'Cliente';
      case 'PERSONAL_TRAINER': return 'Personal Trainer';
      case 'NUTRITIONIST': return 'Nutrizionista';
      case 'ADMIN': return 'Admin';
      case 'MODERATOR': return 'Moderatore';
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
      case 'MODERATOR': return 'bg-fuchsia-50 text-fuchsia-700';
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
      case 'MODERATOR': return '🧭';
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
