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

  private baseUrl = 'http://localhost:8080/api/auth';

  login(credentials: any): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/login`, credentials).pipe(
      tap(response => {
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response));
      })
    );
  }

  register(userData: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/register`, userData);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  getPlans(): Observable<any> {
    return this.http.get('http://localhost:8080/api/plans');
  }

  getProfessionals(role: string): Observable<any> {
    return this.http.get(`http://localhost:8080/api/professionals?role=${role}`);
  }

  /**
   * Recupera tutti i dati della dashboard per l'utente con il dato id.
   * GET /api/dashboard/{userId}
   * Risposta attesa: { profile, subscription, followingProfessionals, upcomingBookings }
   */
  getDashboard(userId: number): Observable<any> {
    // Corretto: aggiungi /users/ nel path
    return this.http.get(`http://localhost:8080/api/users/dashboard/${userId}`);
  }
}
