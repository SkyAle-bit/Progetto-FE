import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment'; // IMPORTANTE: Importa l'environment!

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

  // Usa l'URL dell'ambiente corrente!
  private apiUrl = environment.apiUrl; 
  private baseUrl = `${this.apiUrl}/api/auth`;

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
    return this.http.get(`${this.apiUrl}/api/plans`);
  }

  getProfessionals(role: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/professionals?role=${role}`);
  }

  getDashboard(userId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/users/dashboard/${userId}`);
  }

  getProfessionalSlots(professionalId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/professionals/${professionalId}/slots`);
  }

  createProfessionalSlots(professionalId: number, slots: any[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/professionals/${professionalId}/slots`, slots);
  }

  deleteProfessionalSlot(professionalId: number, slotId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/api/professionals/${professionalId}/slots/${slotId}`);
  }

  createBooking(request: { userId: number; slotId: number }): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/bookings`, request);
  }
}