import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-clients-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './clients-list.html',
  styleUrls: ['./clients-list.css']
})
export class ClientsListComponent implements OnInit {
  authService = inject(AuthService);
  router = inject(Router);
  cdr = inject(ChangeDetectorRef);
  clients: any[] = [];
  professionalId: number = 0;

  ngOnInit() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      // Extra check: only PTs and Nutritionists should see this
      if (user.role === 'CLIENT') {
        this.router.navigate(['/dashboard']);
        return;
      }
      this.professionalId = user.id;
      this.loadClients();
    } else {
      this.router.navigate(['/login']);
    }
  }

  loadClients() {
    console.log('Chiamo getMyClients per ID: ', this.professionalId);
    this.authService.getMyClients(this.professionalId).subscribe({
      next: (res: any) => {
        console.log('Risposta OK dal backend: ', res);
        // Assicura che diventi un Array pulito, ed eseguiamo Change Detection forzata
        this.clients = Array.isArray(res) ? res : (res && res.value) ? res.value : [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Errore durante loadClients frontend: ', err);
      }
    });
  }
}
