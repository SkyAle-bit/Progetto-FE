import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Plan } from '../models/dashboard.types';

@Injectable({
  providedIn: 'root'
})
export class PlanService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getPlans(): Observable<Plan[]> {
    return this.http.get<Plan[]>(`${this.apiUrl}/api/plans`);
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
}

