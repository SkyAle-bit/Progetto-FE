import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AuthService } from './auth.service';
import {
  ProfessionalSlot,
  SlotPayload,
  BookingRequest,
} from '../models/dashboard.types';

const START_HOUR = 8;
const END_HOUR = 21;

/**
 * Service responsabile della logica di disponibilità, slot e prenotazioni.
 * Estrae dal DashboardComponent tutte le operazioni non-presentazionali
 * legate al calendario, alla gestione slot del professionista e alla
 * prenotazione da parte del cliente.
 */
@Injectable({ providedIn: 'root' })
export class AvailabilityService {
  private authService = inject(AuthService);

  // ── HTTP: Slot professionista ────────────────────────────

  /** Carica tutti gli slot di un professionista. */
  loadProfessionalSlots(professionalId: number): Observable<ProfessionalSlot[]> {
    return this.authService.getProfessionalSlots(professionalId);
  }

  /** Crea nuovi slot di disponibilità per un professionista. */
  createSlots(professionalId: number, slots: SlotPayload[]): Observable<void> {
    return this.authService.createProfessionalSlots(professionalId, slots);
  }

  /** Elimina un singolo slot di un professionista. */
  deleteSlot(professionalId: number, slotId: number): Observable<void> {
    return this.authService.deleteProfessionalSlot(professionalId, slotId);
  }

  // ── HTTP: Booking cliente ────────────────────────────────

  /**
   * Carica gli slot disponibili di un professionista, filtrati a partire da
   * domani. Slot nel passato e nella giornata corrente vengono esclusi.
   */
  getAvailableSlotsFromTomorrow(professionalId: number): Observable<ProfessionalSlot[]> {
    return this.loadProfessionalSlots(professionalId).pipe(
      map(slots => {
        const tomorrow = new Date();
        tomorrow.setHours(0, 0, 0, 0);
        tomorrow.setDate(tomorrow.getDate() + 1);

        return slots.filter(s =>
          (s.available || s.isAvailable) && new Date(s.startTime) >= tomorrow
        );
      })
    );
  }

  /** Crea una prenotazione. */
  createBooking(request: BookingRequest): Observable<void> {
    return this.authService.createBooking(request);
  }

  /** Annulla una prenotazione. */
  cancelBooking(bookingId: number, userId: number): Observable<void> {
    return this.authService.cancelBooking(bookingId, userId);
  }

  // ── Pure: Costruzione giorni e time slots ─────────────────

  /** Genera la lista dei 7 giorni della settimana prossima (lun–dom). */
  buildNextWeekDays(): Date[] {
    const today = new Date();
    const dow = today.getDay();
    const daysUntilNextMonday = dow === 0 ? 1 : 8 - dow;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilNextMonday);
    nextMonday.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(nextMonday);
      d.setDate(nextMonday.getDate() + i);
      return d;
    });
  }

  /** Genera una griglia di fasce orarie da 30 minuti. */
  buildTimeSlots(): string[] {
    const slots: string[] = [];
    for (let h = START_HOUR; h < END_HOUR; h++) {
      slots.push(`${h.toString().padStart(2, '0')}:00`);
      slots.push(`${h.toString().padStart(2, '0')}:30`);
    }
    return slots;
  }

  /** Formatta una Date in stringa "yyyy-MM-dd". */
  formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** Chiave univoca per identificare uno slot (es. "2026-04-14|09:00"). */
  slotKey(day: Date, time: string): string {
    return `${this.formatDate(day)}|${time}`;
  }

  /** Label leggibile per la settimana prossima (es. "14 aprile – 20 aprile 2026"). */
  getNextWeekLabel(days: Date[]): string {
    if (days.length === 0) return '';
    const first = days[0];
    const last = days[days.length - 1];
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
    return `${first.toLocaleDateString('it-IT', opts)} – ${last.toLocaleDateString('it-IT', { ...opts, year: 'numeric' })}`;
  }

  /** Nome abbreviato del giorno (es. "LUN"). */
  getDayName(date: Date): string {
    return date.toLocaleDateString('it-IT', { weekday: 'short' }).toUpperCase();
  }

  /** Numero del giorno nel mese (es. 14). */
  getDayNumber(date: Date): number {
    return date.getDate();
  }

  /** Verifica se una fascia oraria è un'ora piena (":00"). */
  isFullHour(slot: string): boolean {
    return slot.endsWith(':00');
  }

  // ── Pure: Booking day/slot helpers ─────────────────────────

  /**
   * Data una lista di slot, estrae i giorni unici (senza ore)
   * ordinati cronologicamente.
   */
  buildBookingDays(slots: ProfessionalSlot[]): Date[] {
    const uniqueTimestamps = new Set<number>();

    for (const s of slots) {
      const d = new Date(s.startTime);
      d.setHours(0, 0, 0, 0);
      uniqueTimestamps.add(d.getTime());
    }

    return Array.from(uniqueTimestamps)
      .map(ts => new Date(ts))
      .sort((a, b) => a.getTime() - b.getTime());
  }

  /**
   * Filtra e ordina gli slot appartenenti a un determinato giorno.
   */
  getSlotsForDay(slots: ProfessionalSlot[], day: Date): ProfessionalSlot[] {
    const dayTime = day.getTime();

    return slots
      .filter(s => {
        const d = new Date(s.startTime);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === dayTime;
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  /** Restituisce "HH:mm" da un ISO datetime string. */
  getSlotTimeLabel(slot: ProfessionalSlot): string {
    const d = new Date(slot.startTime);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  // ── Pure: Costruzione payload ─────────────────────────────

  /**
   * Converte i Set di chiavi "date|time" selezionati dall'utente in un
   * array di SlotPayload pronto per l'invio al backend.
   * Ogni slot ha durata fissa di 30 minuti.
   */
  buildSlotPayloads(selectedKeys: Set<string>): SlotPayload[] {
    const pad = (n: number) => n.toString().padStart(2, '0');

    return Array.from(selectedKeys).map(key => {
      const [date, time] = key.split('|');
      const startStr = `${date}T${time}:00`;
      const startDate = new Date(startStr);
      const endDate = new Date(startDate.getTime() + 30 * 60000);

      const endStr = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}:00`;

      return { startTime: startStr, endTime: endStr, isAvailable: true };
    });
  }
}
