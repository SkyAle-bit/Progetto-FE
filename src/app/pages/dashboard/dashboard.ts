import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  // Variabile per salvare i dati dell'utente loggato
  currentUser: any = null;

  ngOnInit(): void {
    // Recuperiamo i dati dell'utente dal localStorage
    const userString = localStorage.getItem('user');
    if (userString) {
      this.currentUser = JSON.parse(userString);
    } else {
      // Se non c'è un utente loggato, lo rispediamo al login (Sicurezza!)
      this.router.navigate(['/login']);
    }
  }

  logout(): void {
    this.authService.logout(); // Cancella il token e i dati
    this.router.navigate(['/login']); // Torna alla schermata iniziale
  }
}


