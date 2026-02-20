import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface AuthResponse {
  token: string;
  type: string;
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  profilePicture?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);

  // URL del tuo backend Spring Boot
  private baseUrl = 'http://localhost:8080/api/auth';

  // Chiamata di Login
  login(credentials: any): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/login`, credentials).pipe(
      tap(response => {
        // Salva il token e i dati utente per mantenerlo connesso
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response));
      })
    );
  }

  // Chiamata di Registrazione
  register(userData: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/register`, userData);
  }

  // Verifica se l'utente è loggato
  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  // Logout (cancella i dati)
  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
}
