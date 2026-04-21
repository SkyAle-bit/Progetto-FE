import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './reset-password.html',
  styleUrls: ['../login/login.css', './reset-password.css']
})
export class ResetPasswordComponent {
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // Stato della vista: 'request' (inserisci email) oppure 'reset' (inserisci nuova password, con token)
  mode: 'request' | 'reset' = 'request';

  // Form fields
  email: string = '';
  newPassword: string = '';
  confirmPassword: string = '';
  token: string = '';
  showPassword = false;

  // UI state
  loading: boolean = false;
  successMessage: string = '';
  errorMessage: string = '';

  ngOnInit(): void {
    // Handle query string token
    this.route.queryParams.subscribe(params => {
      if (params['token']) {
        this.token = params['token'];
        this.mode = 'reset';
      }
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  requestReset(): void {
    if (!this.email.trim()) {
      this.errorMessage = 'Inserisci la tua email.';
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService.forgotPassword(this.email).subscribe({
      next: (res: any) => {
        this.loading = false;
        this.successMessage = 'Link di reset inviato con successo alla tua email! Verrai reindirizzato al login...';
        setTimeout(() => this.router.navigate(['/login']), 3000);
      },
      error: (err) => {
        this.loading = false;
        const msg = err?.error?.message || err?.error?.error;
        if (msg) {
          this.errorMessage = msg;
        } else {
          this.errorMessage = 'Nessun account trovato con questa email. Riprova.';
        }
      }
    });
  }

  resetPassword(): void {
    this.errorMessage = '';

    if (!this.newPassword.trim()) {
      this.errorMessage = 'Inserisci una nuova password.';
      return;
    }

    if (this.newPassword.length < 6) {
      this.errorMessage = 'La password deve avere almeno 6 caratteri.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Le password non corrispondono.';
      return;
    }

    this.loading = true;
    this.successMessage = '';

    this.authService.resetPassword(this.token, this.newPassword).subscribe({
      next: () => {
        this.loading = false;
        this.successMessage = 'Password reimpostata con successo! Verrai reindirizzato al login...';
        setTimeout(() => this.router.navigate(['/login']), 3000);
      },
      error: (err) => {
        this.loading = false;
        const msg = err?.error?.message || err?.error?.error;
        if (msg) {
          this.errorMessage = msg;
        } else {
          this.errorMessage = 'Errore durante il reset della password. Il link potrebbe essere scaduto o già utilizzato.';
        }
      }
    });
  }
}
