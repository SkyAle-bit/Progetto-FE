import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ProfessionalSlot,
  SlotPayload,
  BookingRequest,
  ProfessionalSummary
} from '../models/dashboard.types';

@Injectable({
  providedIn: 'root'
})
export class SlotService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

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

  getProfessionals(role: string): Observable<ProfessionalSummary[]> {
    return this.http.get<ProfessionalSummary[]>(`${this.apiUrl}/api/professionals?role=${role}`);
  }
}

