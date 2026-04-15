import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { AvailabilityService } from './availability.service';
import { ToastService } from './toast.service';
import { ProfessionalSlot, BookingRequest, ProfessionalSummary } from '../models/dashboard.types';
import { HttpErrorResponse } from '@angular/common/http';

export interface CalendarState {
  isAvailabilityOpen: boolean;
  isLoading: boolean;
  nextWeekDays: Date[];
  selectedSlots: Set<string>;
  existingSlots: Set<string>;
  existingSlotIds: Map<string, number>;
  lockedSlots: Set<string>;
  copiedDay: Date | null;
  timeSlots: string[];
}

export interface BookingState {
  isBookingOpen: boolean;
  isLoading: boolean;
  selectedProfessional: ProfessionalSummary | null;
  availableBookingSlots: ProfessionalSlot[];
  bookingDays: Date[];
  selectedBookingDay: Date | null;
  slotsForSelectedDay: ProfessionalSlot[];
  selectedBookingSlot: ProfessionalSlot | null;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardFacadeService {
  private availabilityService = inject(AvailabilityService);
  private toast = inject(ToastService);

  private calendarState = new BehaviorSubject<CalendarState>({
    isAvailabilityOpen: false,
    isLoading: false,
    nextWeekDays: [],
    selectedSlots: new Set(),
    existingSlots: new Set(),
    existingSlotIds: new Map(),
    lockedSlots: new Set(),
    copiedDay: null,
    timeSlots: this.availabilityService.buildTimeSlots()
  });

  private bookingState = new BehaviorSubject<BookingState>({
    isBookingOpen: false,
    isLoading: false,
    selectedProfessional: null,
    availableBookingSlots: [],
    bookingDays: [],
    selectedBookingDay: null,
    slotsForSelectedDay: [],
    selectedBookingSlot: null
  });

  calendarState$ = this.calendarState.asObservable();
  bookingState$ = this.bookingState.asObservable();

  get currentCalendarState(): CalendarState {
    return this.calendarState.value;
  }

  get currentBookingState(): BookingState {
    return this.bookingState.value;
  }

  // ── Availability ────────────────────────────────────────────────────────

  openAvailability(professionalId: number): void {
    const nextWeekDays = this.availabilityService.buildNextWeekDays();
    this.updateCalendarState({
      isAvailabilityOpen: true,
      isLoading: true,
      nextWeekDays,
      selectedSlots: new Set(),
      existingSlots: new Set(),
      existingSlotIds: new Map(),
      lockedSlots: new Set(),
      copiedDay: null
    });

    this.availabilityService.loadProfessionalSlots(professionalId).subscribe({
      next: (slots) => {
        const state = this.currentCalendarState;
        const existingSlots = new Set<string>();
        const existingSlotIds = new Map<string, number>();
        const lockedSlots = new Set<string>();

        slots.forEach((slot: any) => {
          const start = new Date(slot.startTime);
          const timeLabel = this.availabilityService.getSlotTimeLabel(slot);
          const key = this.availabilityService.slotKey(start, timeLabel);

          existingSlots.add(key);
          existingSlotIds.set(key, slot.id);
          if (slot.isAvailable === false || slot.available === false) {
            lockedSlots.add(key);
          }
        });

        this.updateCalendarState({
          isLoading: false,
          existingSlots,
          existingSlotIds,
          lockedSlots
        });
      },
      error: (err) => {
        console.error(err);
        this.updateCalendarState({ isLoading: false });
      }
    });
  }

  closeAvailability(): void {
    this.updateCalendarState({
      isAvailabilityOpen: false,
      copiedDay: null,
      selectedSlots: new Set()
    });
  }

  toggleSlot(day: Date, slot: string, professionalId: number, onSuccess: () => void): void {
    const state = this.currentCalendarState;
    const key = this.availabilityService.slotKey(day, slot);

    if (state.existingSlots.has(key)) {
      if (state.lockedSlots.has(key)) {
        this.toast.warning('Slot Prenotato', 'Questo slot è già stato prenotato da un cliente e non può essere rimosso.');
      } else {
        const slotId = state.existingSlotIds.get(key);
        if (slotId && confirm('Vuoi rimuovere questa disponibilità?')) {
          this.updateCalendarState({ isLoading: true });
          this.availabilityService.deleteSlot(professionalId, slotId).subscribe({
            next: () => {
              const newExisting = new Set(state.existingSlots);
              const newIds = new Map(state.existingSlotIds);
              newExisting.delete(key);
              newIds.delete(key);
              this.updateCalendarState({
                isLoading: false,
                existingSlots: newExisting,
                existingSlotIds: newIds
              });
              onSuccess();
            },
            error: (err) => {
              console.error(err);
              this.updateCalendarState({ isLoading: false });
              this.toast.error('Errore', 'Impossibile rimuovere lo slot.');
            }
          });
        }
      }
      return;
    }

    const newSelected = new Set(state.selectedSlots);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    this.updateCalendarState({ selectedSlots: newSelected });
  }

  confirmAvailability(professionalId: number, onSuccess: () => void): void {
    const state = this.currentCalendarState;
    if (state.selectedSlots.size === 0) {
      this.toast.warning('Attenzione', 'Nessuno slot selezionato.');
      return;
    }

    this.updateCalendarState({ isLoading: true });
    const slotsPayload = this.availabilityService.buildSlotPayloads(state.selectedSlots);

    this.availabilityService.createSlots(professionalId, slotsPayload).subscribe({
      next: () => {
        this.toast.success('Fatto', 'Disponibilità salvate con successo.');
        this.closeAvailability();
        onSuccess();
      },
      error: (err) => {
        console.error(err);
        this.updateCalendarState({ isLoading: false });
        this.toast.error('Errore', 'Errore durante il salvataggio.');
      }
    });
  }

  copyDay(day: Date): void {
    this.updateCalendarState({ copiedDay: day });
  }

  clearCopy(): void {
    this.updateCalendarState({ copiedDay: null });
  }

  pasteDay(targetDay: Date): void {
    const state = this.currentCalendarState;
    if (!state.copiedDay) return;

    const sourceSlots = state.timeSlots.filter(slot =>
      state.selectedSlots.has(this.availabilityService.slotKey(state.copiedDay!, slot))
    );

    const newSelected = new Set(state.selectedSlots);
    sourceSlots.forEach(slot => newSelected.add(this.availabilityService.slotKey(targetDay, slot)));

    this.updateCalendarState({ selectedSlots: newSelected, copiedDay: null });
  }

  // ── Booking ────────────────────────────────────────────────────────────

  openBooking(professional: ProfessionalSummary): void {
    this.updateBookingState({
      isBookingOpen: true,
      isLoading: true,
      selectedProfessional: professional,
      availableBookingSlots: [],
      bookingDays: [],
      selectedBookingDay: null,
      slotsForSelectedDay: [],
      selectedBookingSlot: null
    });

    this.availabilityService.getAvailableSlotsFromTomorrow(professional.id).subscribe({
      next: (slots) => {
        const bookingDays = this.availabilityService.buildBookingDays(slots);
        let selectedBookingDay = null;
        let slotsForSelectedDay: any[] = [];

        if (bookingDays.length > 0) {
          selectedBookingDay = bookingDays[0];
          slotsForSelectedDay = this.availabilityService.getSlotsForDay(slots, selectedBookingDay);
        }

        this.updateBookingState({
          isLoading: false,
          availableBookingSlots: slots,
          bookingDays,
          selectedBookingDay,
          slotsForSelectedDay
        });
      },
      error: (err) => {
        console.error(err);
        this.updateBookingState({ isLoading: false });
      }
    });
  }

  closeBooking(): void {
    this.updateBookingState({
      isBookingOpen: false,
      selectedProfessional: null,
      availableBookingSlots: [],
      bookingDays: [],
      selectedBookingDay: null,
      slotsForSelectedDay: [],
      selectedBookingSlot: null
    });
  }

  selectBookingDay(day: Date): void {
    const state = this.currentBookingState;
    this.updateBookingState({
      selectedBookingDay: day,
      selectedBookingSlot: null,
      slotsForSelectedDay: this.availabilityService.getSlotsForDay(state.availableBookingSlots, day)
    });
  }

  toggleBookingSlot(slot: ProfessionalSlot): void {
    const state = this.currentBookingState;
    if (state.selectedBookingSlot?.id === slot.id) {
      this.updateBookingState({ selectedBookingSlot: null });
    } else {
      this.updateBookingState({ selectedBookingSlot: slot });
    }
  }

  confirmBooking(userId: number, onSuccess: () => void): void {
    const state = this.currentBookingState;
    if (!state.selectedBookingSlot || !state.selectedProfessional) return;

    this.updateBookingState({ isLoading: true });
    const request = {
      userId,
      slotId: state.selectedBookingSlot.id
    };

    this.availabilityService.createBooking(request).subscribe({
      next: () => {
        this.toast.success('Prenotato', 'Appuntamento confermato.');
        this.closeBooking();
        onSuccess();
      },
      error: (err) => {
        console.error(err);
        this.updateBookingState({ isLoading: false });
        this.toast.error('Errore', 'Impossibile completare la prenotazione.');
      }
    });
  }

  private updateCalendarState(partial: Partial<CalendarState>): void {
    this.calendarState.next({ ...this.calendarState.value, ...partial });
  }

  private updateBookingState(partial: Partial<BookingState>): void {
    this.bookingState.next({ ...this.bookingState.value, ...partial });
  }
}

