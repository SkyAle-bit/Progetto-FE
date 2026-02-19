import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.html', // Assicurati che si chiami register.html
  styleUrls: ['./register.css']   // Assicurati che si chiami register.css
})
export class RegisterComponent {
  registerForm: FormGroup;
  errorMessage: string = '';
  successMessage: string = '';

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  constructor() {
    // Configurazione del form con i campi obbligatori
    this.registerForm = this.fb.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  onSubmit(): void {
    if (this.registerForm.valid) {

      // Prepariamo i dati unendo il form agli ID dei professionisti (richiesti dal backend)
      const userData = {
        ...this.registerForm.value,
        selectedPtId: 1,              // ID di default per il test
        selectedNutritionistId: 2     // ID di default per il test
      };

      this.authService.register(userData).subscribe({
        next: (response: any) => {
          this.successMessage = 'Registrazione completata! Ti stiamo reindirizzando al login...';
          this.errorMessage = '';

          // Aspetta 2 secondi e poi manda l'utente alla pagina di login
          setTimeout(() => {
            this.router.navigate(['/login']).then();
          }, 2000);
        },
        error: (err: any) => {
          console.error('Errore di registrazione:', err);
          // Mostra il messaggio di errore che arriva da Spring Boot (es. "Email già registrata")
          this.errorMessage = err.error?.message || 'Errore durante la registrazione. Riprova.';
          this.successMessage = '';
        }
      });
    } else {
      this.registerForm.markAllAsTouched();
    }
  }
}
