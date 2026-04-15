import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

import {
  DashboardData,
  ClientBasicInfo,
  ProStats,
  UserProfile,
  ProfileEditData,
  ActivityFeedItem
} from '../models/dashboard.types';
import { UserManagementMode, ManagedUserPayload } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getDashboard(userId: number): Observable<DashboardData> {
    return this.http.get<DashboardData>(`${this.apiUrl}/api/users/dashboard/${userId}`);
  }

  updateProfile(userId: number, profileData: ProfileEditData): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/api/users/${userId}/profile`, profileData);
  }

  getAdmin(): Observable<ClientBasicInfo> {
    return this.http.get<ClientBasicInfo>(`${this.apiUrl}/api/users/admin`);
  }

  getMyClients(professionalId: number): Observable<ClientBasicInfo[]> {
    return this.http.get<ClientBasicInfo[]>(`${this.apiUrl}/api/users/${professionalId}/clients`);
  }

  getAllUsers(): Observable<UserProfile[]> {
    return this.http.get<UserProfile[]>(`${this.apiUrl}/api/admin/users`);
  }

  createUser(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/admin/users`, data);
  }

  deleteUser(userId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/api/admin/users/${userId}`);
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

  getProfessionalStats(professionalId: number): Observable<ProStats> {
    return this.http.get<ProStats>(`${this.apiUrl}/api/professional/stats/${professionalId}`);
  }

  getActivityFeed(userId: number, days: number = 14, limit: number = 15): Observable<ActivityFeedItem[]> {
    return this.http.get<ActivityFeedItem[]>(`${this.apiUrl}/api/activity/feed/${userId}?days=${days}&limit=${limit}`);
  }

  getAdminStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/admin/stats`);
  }
}


