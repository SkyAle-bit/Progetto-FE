import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

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

export type UserManagementMode = 'admin' | 'moderator';

export interface ManagedUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  role: string;
  planId?: number;
  assignedPTId?: number;
  assignedNutritionistId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);

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

  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/reset-password`, { token, newPassword });
  }
}
