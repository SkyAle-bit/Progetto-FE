import { Component, inject } from '@angular/core';
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
export class RegisterComponent {
  registerForm: FormGroup;
  errorMessage: string = '';
  successMessage: string = '';

  // Variabile per salvare l'immagine convertita in testo
  profilePictureBase64: string | null = null;

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  constructor() {
    this.registerForm = this.fb.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  // NUOVO METODO: Cattura il file quando l'utente lo seleziona
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        // Salva il risultato (una lunga stringa tipo "data:image/png;base64,iVBORw0KG...")
        this.profilePictureBase64 = e.target.result;
      };
      reader.readAsDataURL(file); // Avvia la conversione
    }
  }

  onSubmit(): void {
    if (this.registerForm.valid) {

      const userData = {
        ...this.registerForm.value,
        profilePicture: this.profilePictureBase64, // <-- INVIA L'IMMAGINE AL BACKEND
        selectedPtId: 1,
        selectedNutritionistId: 2
      };

      this.authService.register(userData).subscribe({
        next: (response: any) => {
          this.successMessage = 'Registrazione completata! Ti stiamo reindirizzando...';
          this.errorMessage = '';
          setTimeout(() => {
            this.router.navigate(['/login']).then();
          }, 2000);
        },
        error: (err: any) => {
          this.errorMessage = err.error?.message || 'Errore durante la registrazione. Riprova.';
          this.successMessage = '';
        }
      });
    } else {
      this.registerForm.markAllAsTouched();
    }
  }
}
