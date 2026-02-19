import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true, // Assicurati che sia true se stai usando Angular 14+
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage: string = '';

  // Iniezione delle dipendenze moderna (Angular 14+)
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  constructor() {
    // 1. Configurazione del Form e delle regole di Validazione
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  // 2. Metodo eseguito al click sul bottone "Accedi"
  onSubmit(): void {
    if (this.loginForm.valid) {
      this.authService.login(this.loginForm.value).subscribe({
        next: (response) => {
          console.log('Login completato con successo!', response);
          // Se va a buon fine, navighiamo verso una pagina protetta (es. la dashboard)
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          console.error('Errore durante il login:', err);
          // Mostriamo un messaggio di errore a schermo (es. cattura il 401 Unauthorized)
          this.errorMessage = 'Email o password errati. Riprova.';
        }
      });
    } else {
      // Forza la visualizzazione degli errori rossi se l'utente clicca senza scrivere niente
      this.loginForm.markAllAsTouched();
    }
  }
}

export class Login {
}
