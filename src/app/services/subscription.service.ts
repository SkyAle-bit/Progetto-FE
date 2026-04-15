import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Subscription } from '../models/dashboard.types';
import { UserManagementMode } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getAllSubscriptions(): Observable<Subscription[]> {
    return this.http.get<Subscription[]>(`${this.apiUrl}/api/admin/subscriptions`);
  }

  private usersBaseByMode(mode: UserManagementMode): string {
    return mode === 'moderator'
      ? `${this.apiUrl}/api/moderator/users`
      : `${this.apiUrl}/api/admin/users`;
  }

  getAllSubscriptionsByMode(mode: UserManagementMode): Observable<Subscription[]> {
    const url = `${this.usersBaseByMode(mode).replace('/users', '')}/subscriptions`;
    return this.http.get<Subscription[]>(url);
  }

  updateSubscriptionCredits(mode: UserManagementMode, subscriptionId: number, creditsPT: number, creditsNutri: number): Observable<any> {
    const url = `${this.usersBaseByMode(mode).replace('/users', '')}/subscriptions/${subscriptionId}/credits`;
    return this.http.put<any>(url, { creditsPT, creditsNutri });
  }
}

