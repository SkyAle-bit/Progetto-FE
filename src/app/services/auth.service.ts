import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  DashboardData,
  ProfessionalSlot,
  ProfessionalSummary,
  SlotPayload,
  BookingRequest,
  ClientBasicInfo,
  ActivityFeedItem,
  ProStats,
  Subscription,
  Plan,
  UserProfile,
  ProfileEditData,
} from '../models/dashboard.types';

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

  getPlans(): Observable<Plan[]> {
    return this.http.get<Plan[]>(`${this.apiUrl}/api/plans`);
  }

  getProfessionals(role: string): Observable<ProfessionalSummary[]> {
    return this.http.get<ProfessionalSummary[]>(`${this.apiUrl}/api/professionals?role=${role}`);
  }

  getDashboard(userId: number): Observable<DashboardData> {
    return this.http.get<DashboardData>(`${this.apiUrl}/api/users/dashboard/${userId}`);
  }

  updateProfile(userId: number, profileData: ProfileEditData): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/api/users/${userId}/profile`, profileData);
  }

  getAdmin(): Observable<ClientBasicInfo> {
    return this.http.get<ClientBasicInfo>(`${this.apiUrl}/api/users/admin`);
  }

  getProfessionalSlots(professionalId: number): Observable<ProfessionalSlot[]> {
    return this.http.get<ProfessionalSlot[]>(`${this.apiUrl}/api/professionals/${professionalId}/slots`);
  }

  createProfessionalSlots(professionalId: number, slots: SlotPayload[]): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/professionals/${professionalId}/slots`, slots);
  }

  deleteProfessionalSlot(professionalId: number, slotId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/professionals/${professionalId}/slots/${slotId}`);
  }

  createBooking(request: BookingRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/bookings`, request);
  }

  cancelBooking(bookingId: number, userId: number): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/api/bookings/${bookingId}/cancel?userId=${userId}`, {});
  }

  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/reset-password`, { token, newPassword });
  }

  getMyClients(professionalId: number): Observable<ClientBasicInfo[]> {
    const timestamp = new Date().getTime();
    return this.http.get<ClientBasicInfo[]>(`${this.apiUrl}/api/users/${professionalId}/clients?t=${timestamp}`);
  }

  // ── Documenti ──────────────────────────────────────────────

  uploadDocument(file: File, clientId: number, uploaderId: number, type: string): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('clientId', clientId.toString());
    formData.append('uploaderId', uploaderId.toString());
    formData.append('type', type);
    return this.http.post(`${this.apiUrl}/api/documents/upload`, formData);
  }

  getClientDocuments(clientId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/documents/user/${clientId}`);
  }

  getClientDocumentsByType(clientId: number, type: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/documents/user/${clientId}/type/${type}`);
  }

  getDocumentDownloadUrl(documentId: number): string {
    return `${this.apiUrl}/api/documents/download/${documentId}`;
  }

  downloadDocument(documentId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/api/documents/download/${documentId}`, { responseType: 'blob' });
  }

  deleteDocument(documentId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/api/documents/${documentId}`);
  }

  // ── Admin API ──────────────────────────────────────────────

  getAllUsers(): Observable<UserProfile[]> {
    return this.http.get<UserProfile[]>(`${this.apiUrl}/api/admin/users`);
  }

  getAllSubscriptions(): Observable<Subscription[]> {
    return this.http.get<Subscription[]>(`${this.apiUrl}/api/admin/subscriptions`);
  }

  getAllSubscriptionsByMode(mode: UserManagementMode): Observable<Subscription[]> {
    const url = `${this.usersBaseByMode(mode).replace('/users', '')}/subscriptions`;
    return this.http.get<Subscription[]>(url);
  }

  createUser(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/admin/users`, data);
  }

  deleteUser(userId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/api/admin/users/${userId}`);
  }

  createPlan(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/admin/plans`, data);
  }

  deletePlan(planId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/api/admin/plans/${planId}`);
  }

  updatePlan(planId: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/api/admin/plans/${planId}`, data);
  }

  updateUser(userId: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/api/admin/users/${userId}`, data);
  }

  private usersBaseByMode(mode: UserManagementMode): string {
    return mode === 'moderator'
      ? `${this.apiUrl}/api/moderator/users`
      : `${this.apiUrl}/api/admin/users`;
  }

  getUsersByMode(mode: UserManagementMode): Observable<UserProfile[]> {
    return this.http.get<UserProfile[]>(this.usersBaseByMode(mode));
  }

  getModeratorChatContacts(): Observable<UserProfile[]> {
    return this.http.get<UserProfile[]>(`${this.apiUrl}/api/moderator/chat-contacts`);
  }

  createUserByMode(mode: UserManagementMode, data: ManagedUserPayload): Observable<any> {
    return this.http.post(this.usersBaseByMode(mode), data);
  }

  updateUserByMode(mode: UserManagementMode, userId: number, data: Partial<ManagedUserPayload>): Observable<any> {
    return this.http.put(`${this.usersBaseByMode(mode)}/${userId}`, data);
  }

  deleteUserByMode(mode: UserManagementMode, userId: number): Observable<any> {
    return this.http.delete(`${this.usersBaseByMode(mode)}/${userId}`);
  }

  updateDocumentNotes(documentId: number, notes: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/api/documents/${documentId}/notes`, { notes });
  }

  getProfessionalStats(professionalId: number): Observable<ProStats> {
    return this.http.get<ProStats>(`${this.apiUrl}/api/professional/stats/${professionalId}`);
  }

  getActivityFeed(userId: number, days: number = 14, limit: number = 15): Observable<ActivityFeedItem[]> {
    return this.http.get<ActivityFeedItem[]>(`${this.apiUrl}/api/activity/feed/${userId}?days=${days}&limit=${limit}`);
  }

  updateSubscriptionCredits(mode: UserManagementMode, subscriptionId: number, creditsPT: number, creditsNutri: number): Observable<any> {
    const url = `${this.usersBaseByMode(mode).replace('/users', '')}/subscriptions/${subscriptionId}/credits`;
    return this.http.put<any>(url, { creditsPT, creditsNutri });
  }

  getAdminStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/admin/stats`);
  }
}
