import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators, ValidationErrors, FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PlanService } from '../../services/plan.service';
import { SlotService } from '../../services/slot.service';
import { ReviewService, ReviewResponse } from '../../services/review.service';

// Validator custom: verifica che password e conferma combacino
function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const parent = control.parent;
  if (!parent) return null;
  const pwd = parent.get('password')?.value;
  return control.value && control.value !== pwd ? { mismatch: true } : null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, FormsModule],
  templateUrl: './register.html',
  styleUrls: ['./register.css']
})
export class RegisterComponent implements OnInit {
  registerForm: FormGroup;
  isLoading: boolean = false;
  currentStep: number = 1;

  plans: any[] = [];
  personalTrainers: any[] = [];
  nutritionists: any[] = [];

  // ── Ricerca Professionisti
  ptSearch: string = '';
  nutSearch: string = '';

  get filteredPts(): any[] {
    const q = this.ptSearch.toLowerCase().trim();
    return this.personalTrainers.filter(pt =>
      !q || pt.fullName?.toLowerCase().includes(q));
  }

  get filteredNuts(): any[] {
    const q = this.nutSearch.toLowerCase().trim();
    return this.nutritionists.filter(n =>
      !q || n.fullName?.toLowerCase().includes(q));
  }

  profilePictureBase64: string | null = null;

  toast: { message: string; type: 'success' | 'error' } | null = null;
  private toastTimer: any = null;

  private cdr = inject(ChangeDetectorRef);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private planService = inject(PlanService);
  private slotService = inject(SlotService);
  private reviewService = inject(ReviewService);

  // ── Modal Vedi Recensioni ────────────────
  reviewsModal: { prof: any; reviews: ReviewResponse[] } | null = null;
  reviewsLoading = false;

  openReviewsModal(prof: any): void {
    this.reviewsLoading = true;
    this.reviewsModal = { prof, reviews: [] };
    this.reviewService.getReviewsForProfessional(prof.id).subscribe({
      next: (reviews) => {
        if (this.reviewsModal) this.reviewsModal.reviews = reviews;
        this.reviewsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.reviewsLoading = false; }
    });
  }

  closeReviewsModal(): void {
    this.reviewsModal = null;
  }

  showPassword: boolean = false;
  showConfirmPassword: boolean = false;

  constructor() {
    this.registerForm = this.fb.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required, passwordMatchValidator]],
      selectedPlanId: ['', [Validators.required]],
      paymentFrequency: ['UNICA_SOLUZIONE', [Validators.required]],
      selectedPtId: ['', [Validators.required]],
      selectedNutritionistId: ['', [Validators.required]]
    });

    // Re-validate confirmPassword when password changes
    this.registerForm.get('password')?.valueChanges.subscribe(() => {
      this.registerForm.get('confirmPassword')?.updateValueAndValidity();
    });
  }

  togglePasswordVisibility(): void { this.showPassword = !this.showPassword; }
  toggleConfirmPasswordVisibility(): void { this.showConfirmPassword = !this.showConfirmPassword; }

  ngOnInit(): void {
    this.planService.getPlans().subscribe(res => this.plans = res);
    this.slotService.getProfessionals('PERSONAL_TRAINER').subscribe(res => this.personalTrainers = res);
    this.slotService.getProfessionals('NUTRITIONIST').subscribe(res => this.nutritionists = res);

    this.registerForm.get('role')?.valueChanges.subscribe(role => {
      const isTrainer = role === 'PERSONAL_TRAINER';
      const isNutritionist = role === 'NUTRITIONIST';

      this.registerForm.patchValue({
        selectedPtId: isTrainer ? this.registerForm.get('selectedPtId')?.value : null,
        selectedNutritionistId: isNutritionist ? this.registerForm.get('selectedNutritionistId')?.value : null
      });

      this.registerForm.get('selectedPtId')?.setValidators(isTrainer ? [Validators.required] : null);
      this.registerForm.get('selectedNutritionistId')?.setValidators(isNutritionist ? [Validators.required] : null);

      this.registerForm.get('selectedPtId')?.updateValueAndValidity();
      this.registerForm.get('selectedNutritionistId')?.updateValueAndValidity();
    });
  }

  showToast(message: string, type: 'success' | 'error'): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast = { message, type };
    this.cdr.detectChanges();
    this.toastTimer = setTimeout(() => {
      this.toast = null;
      this.cdr.detectChanges();
    }, 4000);
  }

  dismissToast(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast = null;
    this.cdr.detectChanges();
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.profilePictureBase64 = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  goToStep2(): void {
    const step1Valid =
      this.registerForm.get('firstName')?.valid &&
      this.registerForm.get('lastName')?.valid &&
      this.registerForm.get('email')?.valid &&
      this.registerForm.get('password')?.valid &&
      this.registerForm.get('confirmPassword')?.valid;

    if (step1Valid) {
      this.currentStep = 2;
    } else {
      this.showToast('Compila correttamente tutti i dati prima di procedere.', 'error');
      ['firstName', 'lastName', 'email', 'password', 'confirmPassword'].forEach(f =>
        this.registerForm.get(f)?.markAsTouched()
      );
    }
  }

  goToStep1(): void {
    this.currentStep = 1;
  }

  selectPlan(planId: number): void {
    this.registerForm.patchValue({ selectedPlanId: planId });
    this.registerForm.get('selectedPlanId')?.markAsTouched();
  }

  selectPt(id: number): void {
    this.registerForm.patchValue({ selectedPtId: id });
    this.registerForm.get('selectedPtId')?.markAsTouched();
  }

  selectNut(id: number): void {
    this.registerForm.patchValue({ selectedNutritionistId: id });
    this.registerForm.get('selectedNutritionistId')?.markAsTouched();
  }

  getInitials(fullName: string): string {
    if (!fullName) return '?';
    return fullName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  onSubmit(): void {
    if (this.registerForm.valid) {
      this.isLoading = true;
      this.cdr.detectChanges();

      const userData = {
        ...this.registerForm.value,
        profilePicture: this.profilePictureBase64
      };

      this.authService.register(userData).subscribe({
        next: (response: any) => {
          this.isLoading = false;
          this.showToast('Registrazione completata con successo! 🎉', 'success');
          setTimeout(() => {
            this.toast = null;
            this.currentStep = 3;
            this.cdr.detectChanges();
            setTimeout(() => this.router.navigate(['/login']), 6000);
          }, 1500);
        },
        error: (err: any) => {
          this.isLoading = false;
          const msg = err.error?.message || 'Errore durante la registrazione. Riprova.';
          this.showToast(msg, 'error');
        }
      });
    } else {
      this.showToast('Mancano delle selezioni obbligatorie. Controlla tutti i campi.', 'error');
      this.registerForm.markAllAsTouched();
    }
  }
}

export class Register {
}
