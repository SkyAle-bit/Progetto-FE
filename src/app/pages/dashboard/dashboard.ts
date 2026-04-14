import {
  Component, inject, OnInit, OnDestroy, ChangeDetectorRef, HostListener, ViewChild, DestroyRef
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { switchMap, of, catchError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { AvailabilityService } from '../../services/availability.service';
import { ToastService } from '../../services/toast.service';

import { HomeTabComponent } from './components/home-tab/home-tab';
import { CalendarTabComponent } from './components/calendar-tab/calendar-tab';
import { ChatTabComponent } from './components/chat-tab/chat-tab';
import { ClientsTabComponent } from './components/clients-tab/clients-tab';
import { AdminHomeTabComponent } from './components/admin-home-tab/admin-home-tab';
import { AdminUsersTabComponent } from './components/admin-users-tab/admin-users-tab';
import { AdminPlansTabComponent } from './components/admin-plans-tab/admin-plans-tab';
import { InsuranceHomeTabComponent } from './components/insurance-home-tab/insurance-home-tab';
import { MyProfessionalsTabComponent } from './components/my-professionals-tab/my-professionals-tab';
import { MyServicesTabComponent } from './components/my-services-tab/my-services-tab';
import { AdminStatsTabComponent } from './components/admin-stats-tab/admin-stats-tab';
import { ToastComponent } from '../../components/toast/toast';
import { PullToRefreshDirective } from '../../directives/pull-to-refresh.directive';

import {
  AuthUser,
  DashboardData,
  ClientBasicInfo,
  UserProfile,
  Plan,
  Subscription,
  ProStats,
  ActivityFeedItem,
  ProfessionalSlot,
  Booking,
  ProfessionalSummary,
  ProfileEditData,
  ApiErrorResponse,
  TabId
} from '../../models/dashboard.types';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule, HomeTabComponent, CalendarTabComponent, ChatTabComponent,
    ClientsTabComponent, AdminHomeTabComponent, AdminUsersTabComponent, AdminPlansTabComponent,
    InsuranceHomeTabComponent, MyProfessionalsTabComponent, MyServicesTabComponent,
    AdminStatsTabComponent, ToastComponent, PullToRefreshDirective
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild(ChatTabComponent) chatTabComponent!: ChatTabComponent;

  private authService = inject(AuthService);
  private chatService = inject(ChatService);
  private availabilityService = inject(AvailabilityService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  currentUser: AuthUser | null = null;
  dashboardData: DashboardData | null = null;
  isLoading: boolean = true;
  isProfileOpen: boolean = false;
  myClients: ClientBasicInfo[] = [];

  allUsers: UserProfile[] = [];
  chatUsers: UserProfile[] = [];
  allPlans: Plan[] = [];
  allSubscriptions: Subscription[] = [];

  activeTab: TabId = 'home';
  globalUnreadCount: number = 0;

  proStats: ProStats | null = null;
  activityFeed: ActivityFeedItem[] = [];

  isPopupOpen: boolean = false;
  popupTitle: string = '';
  popupMessage: string = '';

  isAvailabilityOpen: boolean = false;
  nextWeekDays: Date[] = [];
  selectedSlots: Set<string> = new Set();
  existingSlots: Set<string> = new Set();
  existingSlotIds: Map<string, number> = new Map();
  lockedSlots: Set<string> = new Set();

  isBookingOpen: boolean = false;
  selectedProfessional: ProfessionalSummary | null = null;
  availableBookingSlots: ProfessionalSlot[] = [];
  selectedBookingSlot: ProfessionalSlot | null = null;

  bookingDays: Date[] = [];
  selectedBookingDay: Date | null = null;
  slotsForSelectedDay: ProfessionalSlot[] = [];

  currentWeekStart: Date = new Date();
  weekDays: Date[] = [];
  timeSlots: string[] = [];
  readonly START_HOUR = 8;
  readonly END_HOUR = 21;

  visibleDayCount: number = 7;
  dayOffset: number = 0;

  isCallModalOpen: boolean = false;
  selectedCallBooking: Booking | null = null;
  canJoinCallNow: boolean = false;
  private timeCheckInterval: ReturnType<typeof setInterval> | null = null;

  isProfileEditOpen: boolean = false;
  isSavingProfile: boolean = false;
  profileEditData: ProfileEditData = {
    firstName: '',
    lastName: '',
    password: '',
    profilePicture: ''
  };

  copiedDay: Date | null = null;

  openPopup(title: string, message: string): void {
    this.popupTitle = title;
    this.popupMessage = message;
    this.isPopupOpen = true;
  }

  showPopupMessage(title: string, message: string): void {
    const t = title.toLowerCase();
    if (t.includes('errore') || t.includes('error')) {
      this.toast.error(title, message);
    } else if (t.includes('attenzione') || t.includes('warning')) {
      this.toast.warning(title, message);
    } else {
      this.toast.success(title, message);
    }
  }

  closePopup(): void {
    this.isPopupOpen = false;
  }

  openProfileEditModal(): void {
    this.profileEditData = {
      firstName: this.profile?.firstName || '',
      lastName: this.profile?.lastName || '',
      password: '',
      profilePicture: this.currentUser?.profilePicture || ''
    };
    this.isProfileEditOpen = true;
  }

  closeProfileEditModal(): void {
    this.isProfileEditOpen = false;
  }

  saveProfileChanges(): void {
    if (!this.currentUser) return;
    this.isSavingProfile = true;

    this.authService.updateProfile(this.currentUser.id, this.profileEditData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSavingProfile = false;
          this.closeProfileEditModal();
          this.toast.success('Successo', 'Profilo aggiornato con successo.');

          if (this.currentUser) {
            this.currentUser.profilePicture = this.profileEditData.profilePicture;
            localStorage.setItem('user', JSON.stringify(this.currentUser));
          }

          this.loadDashboardData();
        },
        error: (err: HttpErrorResponse) => {
          this.isSavingProfile = false;
          const apiError = err.error as ApiErrorResponse;
          this.toast.error('Errore', apiError?.message || 'Impossibile aggiornare il profilo.');
          console.error(err);
        }
      });
  }

  contactAdmin(): void {
    this.closeProfile();
    if (this.isAdmin()) {
      this.toast.warning('Attenzione', 'Sei già un Amministratore.');
      return;
    }
    this.authService.getAdmin()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (adminUser) => {
          this.setTab('chat');
          setTimeout(() => {
            if (this.chatTabComponent) {
              const wasExisting = this.chatTabComponent.startConversationWith(adminUser);
              if (wasExisting) {
                this.toast.success('Chat Supporto', 'Hai già una conversazione aperta con il supporto. Ti abbiamo reindirizzato alla chat esistente.');
              }
            }
          }, 150);
        },
        error: (err: HttpErrorResponse) => {
          const apiError = err.error as ApiErrorResponse;
          this.toast.error('Errore', apiError?.message || "Impossibile recuperare l'account Amministratore.");
          console.error(err);
        }
      });
  }

  ngOnInit(): void {
    const userString = localStorage.getItem('user');
    if (userString) {
      this.currentUser = JSON.parse(userString);
      this.initWeek();
      this.timeSlots = this.availabilityService.buildTimeSlots();
      this.updateVisibleDays();
      this.loadDashboardData();

      if (this.currentUser) {
         this.chatService.init(this.currentUser.id);
      }

      this.chatService.unreadCount$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(count => {
          this.globalUnreadCount = count;
          this.cdr.detectChanges();
        });
    } else {
      this.router.navigate(['/login']);
    }
  }

  ngOnDestroy(): void {
    if (this.timeCheckInterval) {
      clearInterval(this.timeCheckInterval);
    }
    this.chatService.destroy();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateVisibleDays();
    this.cdr.detectChanges();
  }

  updateVisibleDays(): void {
    const w = window.innerWidth;
    if (w < 640) {
      this.visibleDayCount = 3;
    } else if (w < 1024) {
      this.visibleDayCount = 3;
    } else {
      this.visibleDayCount = 7;
    }
    this.buildWeekDays();
  }

  loadDashboardData(): void {
    if (this.isAdmin() || this.isModerator() || this.isInsuranceManager()) {
      this.loadAdminInsuranceData();
      return;
    }

    if (!this.currentUser) return;

    this.authService.getDashboard(this.currentUser.id).pipe(
      switchMap(data => {
        this.dashboardData = data;
        if (this.isProfessional()) {
          return this.authService.getMyClients(this.currentUser!.id);
        }
        return of([] as ClientBasicInfo[]);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (clients) => {
        if (this.isProfessional()) {
          this.myClients = Array.isArray(clients) ? clients : [];
          this.loadProStats();
        }
        this.loadActivityFeed();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        console.error('Errore nel caricamento della dashboard', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private loadAdminInsuranceData(): void {
    if (this.isModerator()) {
      let loaded = 0;
      const total = 3;
      const checkDone = () => {
        loaded++;
        if (loaded >= total) {
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      };

      this.authService.getUsersByMode('moderator').pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: (users) => {
          this.allUsers = users ?? [];
          this.authService.getModeratorChatContacts().pipe(
            takeUntilDestroyed(this.destroyRef)
          ).subscribe({
            next: (contacts) => {
              this.loadModeratorChatUsers([...this.allUsers, ...(contacts ?? [])]);
              checkDone();
            },
            error: () => {
              this.loadModeratorChatUsers(this.allUsers);
              checkDone();
            }
          });
        },
        error: () => {
          this.allUsers = [];
          this.chatUsers = [];
          checkDone();
        }
      });

      this.authService.getPlans().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (plans) => {
          this.allPlans = Array.isArray(plans) ? plans : [];
          checkDone();
        },
        error: () => {
          this.allPlans = [];
          checkDone();
        }
      });

      this.authService.getAllSubscriptionsByMode('moderator').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (subs) => { this.allSubscriptions = subs ?? []; checkDone(); },
        error: () => { this.allSubscriptions = []; checkDone(); }
      });

      return;
    }

    let loaded = 0;
    const total = 3;
    const checkDone = () => { loaded++; if (loaded >= total) { this.isLoading = false; this.cdr.detectChanges(); } };

    this.authService.getAllUsers().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (users) => {
        this.allUsers = users ?? [];
        this.chatUsers = [...this.allUsers];
        checkDone();
      },
      error: () => {
        this.allUsers = [];
        this.chatUsers = [];
        checkDone();
      }
    });

    this.authService.getPlans().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (plans) => { this.allPlans = plans ?? []; checkDone(); },
      error: () => { this.allPlans = []; checkDone(); }
    });

    this.authService.getAllSubscriptions().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (subs) => { this.allSubscriptions = subs ?? []; checkDone(); },
      error: () => { this.allSubscriptions = []; checkDone(); }
    });
  }

  private loadModeratorChatUsers(manageableUsers: UserProfile[]): void {
    const baseUsers = Array.isArray(manageableUsers) ? [...manageableUsers] : [];
    this.authService.getAdmin()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (adminUser) => {
          const merged = [...baseUsers, adminUser as unknown as UserProfile].filter((u, index, arr) =>
            u && typeof u.id !== 'undefined' && arr.findIndex(x => x?.id === u.id) === index
          );
          this.chatUsers = merged;
          this.cdr.detectChanges();
        },
        error: () => {
          this.chatUsers = baseUsers;
          this.cdr.detectChanges();
        }
      });
  }

  reloadAdminData(): void {
    this.loadAdminInsuranceData();
  }

  private loadProStats(): void {
    if (!this.isProfessional() || !this.currentUser?.id) return;
    this.authService.getProfessionalStats(this.currentUser.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (stats) => {
          this.proStats = stats;
          this.cdr.detectChanges();
        },
        error: () => { }
      });
  }

  private loadActivityFeed(): void {
    if (!this.currentUser?.id) return;
    this.authService.getActivityFeed(this.currentUser.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (feed) => {
          this.activityFeed = feed || [];
          this.cdr.detectChanges();
        },
        error: () => { }
      });
  }

  onPullRefresh(): void {
    if (this.isAdmin() || this.isModerator() || this.isInsuranceManager()) {
      this.loadAdminInsuranceData();
    } else {
      this.loadDashboardData();
    }
  }

  get profile(): UserProfile | undefined { return this.dashboardData?.profile; }
  get subscription(): Subscription | null | undefined { return this.dashboardData?.subscription; }
  get professionals(): ProfessionalSummary[] { return this.dashboardData?.followingProfessionals ?? []; }
  get bookings(): Booking[] { return this.dashboardData?.upcomingBookings ?? []; }

  isClient(): boolean { return this.currentUser?.role === 'CLIENT'; }
  isProfessional(): boolean {
    const r = this.currentUser?.role;
    return r === 'PERSONAL_TRAINER' || r === 'NUTRITIONIST';
  }
  isAdmin(): boolean { return this.currentUser?.role === 'ADMIN'; }
  isModerator(): boolean { return this.currentUser?.role === 'MODERATOR'; }
  isInsuranceManager(): boolean { return this.currentUser?.role === 'INSURANCE_MANAGER'; }

  setTab(tab: TabId | string): void {
    this.activeTab = tab as TabId;
    if (tab === 'chat') {
      this.globalUnreadCount = 0;
    }
    this.cdr.detectChanges();
  }

  initWeek(): void {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    this.currentWeekStart = new Date(today);
    this.currentWeekStart.setDate(today.getDate() + diff);
    this.currentWeekStart.setHours(0, 0, 0, 0);
    this.dayOffset = 0;
    this.buildWeekDays();
  }

  buildWeekDays(): void {
    this.weekDays = [];
    const count = this.visibleDayCount || 7;
    for (let i = 0; i < count; i++) {
      const d = new Date(this.currentWeekStart);
      d.setDate(this.currentWeekStart.getDate() + this.dayOffset + i);
      this.weekDays.push(d);
    }
  }

  isFullHour(slot: string): boolean { return this.availabilityService.isFullHour(slot); }

  formatDate(date: Date): string { return this.availabilityService.formatDate(date); }

  getDayName(date: Date): string { return this.availabilityService.getDayName(date); }

  getDayNumber(date: Date): number { return this.availabilityService.getDayNumber(date); }

  getBookingLabel(b: Booking): string {
    if (this.isClient()) {
      const role = b.professionalRole === 'PERSONAL_TRAINER' ? 'PT' : 'Nutr.';
      return `${role} – ${b.professionalName ?? ''}`;
    }
    return b.clientName ?? '';
  }

  countWeekBookings(): number {
    return this.weekDays.reduce((acc, day) =>
      acc + this.bookings.filter(b => b.date === this.formatDate(day)).length, 0);
  }

  toggleProfile(): void { this.isProfileOpen = !this.isProfileOpen; }
  closeProfile(): void { this.isProfileOpen = false; }

  getInitials(): string {
    const f = (this.currentUser?.firstName ?? '').charAt(0);
    const l = (this.currentUser?.lastName ?? '').charAt(0);
    return (f + l).toUpperCase();
  }

  getSubscriptionDaysLeft(): number {
    if (!this.subscription?.endDate) return 0;
    const end = new Date(this.subscription.endDate);
    return Math.max(0, Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  }

  buildNextWeekDays(): void {
    this.nextWeekDays = this.availabilityService.buildNextWeekDays();
  }

  openAvailability(): void {
    if (!this.currentUser) return;
    this.buildNextWeekDays();
    this.selectedSlots.clear();
    this.existingSlots.clear();
    this.existingSlotIds.clear();
    this.lockedSlots.clear();
    this.isAvailabilityOpen = true;
    this.isLoading = true;

    this.availabilityService.loadProfessionalSlots(this.currentUser.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (slots) => {
          slots.forEach(slot => {
            const start = new Date(slot.startTime);
            const timeLabel = this.availabilityService.getSlotTimeLabel(slot);
            const key = this.availabilityService.slotKey(start, timeLabel);

            this.existingSlots.add(key);
            this.existingSlotIds.set(key, slot.id);
            if (slot.isAvailable === false || slot.available === false) {
              this.lockedSlots.add(key);
            }
          });
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          console.error('Errore nel caricamento disponibilità esistente', err);
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  closeAvailability(): void {
    this.isAvailabilityOpen = false;
  }

  slotKey(day: Date, slot: string): string {
    return this.availabilityService.slotKey(day, slot);
  }

  toggleSlot(day: Date, slot: string): void {
    if (!this.currentUser) return;
    const key = this.availabilityService.slotKey(day, slot);

    if (this.existingSlots.has(key)) {
      if (this.lockedSlots.has(key)) {
        this.toast.warning('Slot Prenotato', 'Questo slot è già stato prenotato da un cliente e non può essere rimosso.');
      } else {
        const slotId = this.existingSlotIds.get(key);
        if (slotId && confirm('Vuoi rimuovere questa disponibilità?')) {
          this.isLoading = true;
          this.availabilityService.deleteSlot(this.currentUser.id, slotId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => {
                this.existingSlots.delete(key);
                this.existingSlotIds.delete(key);
                this.isLoading = false;
                this.cdr.detectChanges();
                this.loadDashboardData();
              },
              error: (err: HttpErrorResponse) => {
                console.error('Errore rimozione slot', err);
                this.isLoading = false;
                const apiError = err.error as ApiErrorResponse;
                this.toast.error('Errore', apiError?.message || 'Impossibile rimuovere lo slot in questo momento.');
                this.cdr.detectChanges();
              }
            });
        }
      }
      return;
    }

    if (this.selectedSlots.has(key)) {
      this.selectedSlots.delete(key);
    } else {
      this.selectedSlots.add(key);
    }
  }

  isSlotSelected(day: Date, slot: string): boolean {
    return this.selectedSlots.has(this.availabilityService.slotKey(day, slot));
  }

  isSlotExisting(day: Date, slot: string): boolean {
    return this.existingSlots.has(this.availabilityService.slotKey(day, slot));
  }

  isSlotLocked(day: Date, slot: string): boolean {
    return this.lockedSlots.has(this.availabilityService.slotKey(day, slot));
  }

  getSelectedCount(): number {
    return this.selectedSlots.size;
  }

  confirmAvailability(): void {
    if (!this.currentUser) return;
    if (this.selectedSlots.size === 0) {
      this.toast.warning('Attenzione', 'Nessuno slot selezionato.');
      return;
    }

    this.isLoading = true;
    const slotsPayload = this.availabilityService.buildSlotPayloads(this.selectedSlots);

    this.availabilityService.createSlots(this.currentUser.id, slotsPayload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success('Disponibilità Confermate', 'I tuoi slot sono stati salvati con successo. I clienti potranno ora prenotarli.');
          this.selectedSlots.clear();
          this.copiedDay = null;
          this.isLoading = false;
          this.closeAvailability();
          this.loadDashboardData();
        },
        error: (err: HttpErrorResponse) => {
          console.error('Errore salvataggio disponibilità', err);
          const apiError = err.error as ApiErrorResponse;
          this.toast.error('Errore', apiError?.message || 'Si è verificato un errore durante il salvataggio. Riprova più tardi.');
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  get isCopyMode(): boolean { return this.copiedDay !== null; }

  hasDaySlots(day: Date): boolean {
    return this.timeSlots.some(slot => this.isSlotSelected(day, slot));
  }

  isCopiedDay(day: Date): boolean {
    return this.copiedDay !== null && this.availabilityService.formatDate(this.copiedDay) === this.availabilityService.formatDate(day);
  }

  copyDay(day: Date): void {
    this.copiedDay = day;
  }

  clearCopy(): void {
    this.copiedDay = null;
  }

  pasteDay(targetDay: Date): void {
    if (!this.copiedDay) return;
    const sourceSlots = this.timeSlots.filter(slot => this.isSlotSelected(this.copiedDay!, slot));
    sourceSlots.forEach(slot => this.selectedSlots.add(this.availabilityService.slotKey(targetDay, slot)));
    this.copiedDay = null;
  }

  getNextWeekLabel(): string {
    return this.availabilityService.getNextWeekLabel(this.nextWeekDays);
  }

  openBooking(professional: ProfessionalSummary): void {
    this.selectedProfessional = professional;
    this.isLoading = true;
    this.isBookingOpen = true;
    this.availableBookingSlots = [];
    this.bookingDays = [];
    this.selectedBookingDay = null;
    this.slotsForSelectedDay = [];
    this.selectedBookingSlot = null;

    this.availabilityService.getAvailableSlotsFromTomorrow(professional.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (slots) => {
          this.availableBookingSlots = slots;
          this.buildBookingDays();
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          console.error('Errore nel caricamento degli slot', err);
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  closeBooking(): void {
    this.isBookingOpen = false;
    this.selectedProfessional = null;
    this.availableBookingSlots = [];
    this.bookingDays = [];
    this.selectedBookingDay = null;
    this.slotsForSelectedDay = [];
    this.selectedBookingSlot = null;
  }

  buildBookingDays(): void {
    this.bookingDays = this.availabilityService.buildBookingDays(this.availableBookingSlots);
    if (this.bookingDays.length > 0) {
      this.selectBookingDay(this.bookingDays[0]);
    } else {
      this.selectedBookingDay = null;
      this.slotsForSelectedDay = [];
    }
  }

  selectBookingDay(day: Date): void {
    this.selectedBookingDay = day;
    this.selectedBookingSlot = null;
    this.slotsForSelectedDay = this.availabilityService.getSlotsForDay(this.availableBookingSlots, day);
  }

  getSlotTimeLabel(slot: ProfessionalSlot): string {
    return this.availabilityService.getSlotTimeLabel(slot);
  }

  toggleBookingSlot(slot: ProfessionalSlot): void {
    if (!slot) return;
    if (this.selectedBookingSlot?.id === slot.id) {
      this.selectedBookingSlot = null;
    } else {
      this.selectedBookingSlot = slot;
    }
  }

  isBookingSlotSelected(slot: ProfessionalSlot): boolean {
    return this.selectedBookingSlot?.id === slot?.id;
  }

  confirmBooking(): void {
    if (!this.selectedBookingSlot || !this.selectedProfessional || !this.currentUser) return;

    this.isLoading = true;
    const request = {
      userId: this.currentUser.id,
      slotId: this.selectedBookingSlot.id
    };

    this.availabilityService.createBooking(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success('Prenotazione Confermata', `Hai prenotato con successo un appuntamento per il ${this.selectedBookingDay?.toLocaleDateString('it-IT')} alle ${this.getSlotTimeLabel(this.selectedBookingSlot!)}.`);
          this.closeBooking();
          this.loadDashboardData();
        },
        error: (err: HttpErrorResponse) => {
          console.error('Errore nella prenotazione', err);
          const apiError = err.error as ApiErrorResponse;
          this.toast.error('Errore di Prenotazione', apiError?.message || 'Errore durante la prenotazione');
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  isMobileChatOpen(): boolean {
    return this.activeTab === 'chat' && this.chatTabComponent?.chatView === 'conversation';
  }

  openCallModal(booking: Booking): void {
    this.selectedCallBooking = booking;
    this.checkCallTime();
    this.isCallModalOpen = true;

    if (this.timeCheckInterval) clearInterval(this.timeCheckInterval);
    this.timeCheckInterval = setInterval(() => this.checkCallTime(), 10000);
  }

  closeCallModal(): void {
    this.isCallModalOpen = false;
    this.selectedCallBooking = null;
    if (this.timeCheckInterval) {
      clearInterval(this.timeCheckInterval);
      this.timeCheckInterval = null;
    }
  }

  checkCallTime(): void {
    if (!this.selectedCallBooking || this.selectedCallBooking.status === 'CANCELED') {
      this.canJoinCallNow = false;
      return;
    }

    if (this.selectedCallBooking.canJoin) {
      this.canJoinCallNow = true;
      return;
    }

    if (!this.selectedCallBooking.date || !this.selectedCallBooking.startTime) {
      this.canJoinCallNow = false;
      return;
    }

    this.canJoinCallNow = true;
  }

  joinCall(): void {
    if (!this.canJoinCallNow || !this.selectedCallBooking?.meetingLink) return;

    window.open(this.selectedCallBooking.meetingLink, '_blank');
    this.closeCallModal();
  }

  isCancellationAllowed(): boolean {
    if (!this.selectedCallBooking || !this.isClient() || this.selectedCallBooking.status !== 'CONFIRMED') return false;

    const b = this.selectedCallBooking;
    const bookingDate = new Date(`${b.date}T${b.startTime}:00`);
    const now = new Date();
    const diffMs = bookingDate.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    return diffHours >= 24;
  }

  cancelCurrentBooking(): void {
    if (!this.selectedCallBooking || !this.currentUser) return;

    if (!confirm('Sei sicuro di voler annullare questa prenotazione? Lo slot verrà liberato e ti verranno restituiti i crediti.')) {
      return;
    }

    this.isLoading = true;
    this.availabilityService.cancelBooking(this.selectedCallBooking.id, this.currentUser.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success('Prenotazione Annullata', 'La prenotazione è stata annullata con successo.');
          this.closeCallModal();
          this.loadDashboardData();
        },
        error: (err: HttpErrorResponse) => {
          this.isLoading = false;
          const apiError = err.error as ApiErrorResponse;
          this.toast.error('Errore', apiError?.message || 'Impossibile annullare la prenotazione in questo momento.');
          this.cdr.detectChanges();
        }
      });
  }

  getTotalUnread(): number {
    return this.globalUnreadCount;
  }

  onNotificationBellClick(): void {
    this.globalUnreadCount = 0;
    this.setTab('chat');
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
