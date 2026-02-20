import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
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

  profilePictureBase64: string | null = null;

  toast: { message: string; type: 'success' | 'error' } | null = null;
  private toastTimer: any = null;

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    this.registerForm = this.fb.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      selectedPlanId: ['', [Validators.required]],
      paymentFrequency: ['UNICA_SOLUZIONE', [Validators.required]],
      selectedPtId: ['', [Validators.required]],
      selectedNutritionistId: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.authService.getPlans().subscribe(res => this.plans = res);
    this.authService.getProfessionals('PERSONAL_TRAINER').subscribe(res => this.personalTrainers = res);
    this.authService.getProfessionals('NUTRITIONIST').subscribe(res => this.nutritionists = res);
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
      this.registerForm.get('password')?.valid;

    if (step1Valid) {
      this.currentStep = 2;
    } else {
      this.showToast('Compila correttamente tutti i dati prima di procedere.', 'error');
      this.registerForm.markAllAsTouched();
    }
  }

  goToStep1(): void {
    this.currentStep = 1;
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
