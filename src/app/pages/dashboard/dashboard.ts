import {
  Component, inject, OnInit, OnDestroy, ChangeDetectorRef, HostListener, ViewChild, DestroyRef
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, of, switchMap, forkJoin } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { PlanService } from '../../services/plan.service';
import { SubscriptionService } from '../../services/subscription.service';
import { ChatService } from '../../services/chat.service';
import { AvailabilityService } from '../../services/availability.service';
import { DashboardFacadeService } from '../../services/dashboard-facade.service';
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
  TabId,
  UserRole
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
  @ViewChild(ChatTabComponent) 
  set chatTabComponent(content: ChatTabComponent | undefined) {
    this._chatTabComponent = content;
    if (content) {
      const pendingUser = this.dashboardFacade.currentPendingChatUser;
      if (pendingUser) {
        const wasExisting = content.startConversationWith(pendingUser);
        if (wasExisting) {
          this.toast.success('Chat Supporto', 'Hai già una conversazione aperta con il supporto. Ti abbiamo reindirizzato alla chat esistente.');
        }
        this.dashboardFacade.clearPendingChatUser();
      }
    }
  }
  
  get chatTabComponent(): ChatTabComponent | undefined {
    return this._chatTabComponent;
  }
  private _chatTabComponent?: ChatTabComponent;

  private authService = inject(AuthService);
  private userService = inject(UserService);
  private planService = inject(PlanService);
  private subscriptionService = inject(SubscriptionService);
  private chatService = inject(ChatService);
  private availabilityService = inject(AvailabilityService);
  public dashboardFacade = inject(DashboardFacadeService);
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

  calendarState$ = this.dashboardFacade.calendarState$;
  bookingState$ = this.dashboardFacade.bookingState$;

  currentWeekStart: Date = new Date();
  weekDays: Date[] = [];

  visibleDayCount: number = 7;
  dayOffset: number = 0;



  isProfileEditOpen: boolean = false;
  isSavingProfile: boolean = false;
  profileEditData: ProfileEditData = {
    firstName: '',
    lastName: '',
    password: '',
    profilePicture: ''
  };

  openPopup(title: string, message: string): void {
    this.popupTitle = title;
    this.popupMessage = message;
    this.isPopupOpen = true;
  }

  closePopup(): void {
    this.isPopupOpen = false;
  }

  showPopupMessage(title: string, message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
    if (type === 'error') {
      this.toast.error(title, message);
    } else if (type === 'warning') {
      this.toast.warning(title, message);
    } else {
      this.toast.success(title, message);
    }
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

    this.userService.updateProfile(this.currentUser.id, this.profileEditData)
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
    this.userService.getAdmin()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (adminUser) => {
          this.dashboardFacade.setPendingChatUser(adminUser as UserProfile);
          this.setTab('chat');
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

      this.dashboardFacade.actionSuccess$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.loadDashboardData();
        });
    } else {
      this.router.navigate(['/login']);
    }
  }

  ngOnDestroy(): void {
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

    this.userService.getDashboard(this.currentUser.id).pipe(
      switchMap(data => {
        this.dashboardData = data;
        if (this.isProfessional()) {
          return this.userService.getMyClients(this.currentUser!.id);
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
      forkJoin({
        users: this.userService.getUsersByMode('moderator').pipe(
          switchMap(users => {
            if (!users) return of({ allUsers: [], chatUsers: [] });
            return this.userService.getModeratorChatContacts().pipe(
              catchError(() => of([])),
              switchMap(contacts => {
                const allU = users || [];
                const cont = contacts || [];
                const manageableUsers = [...allU, ...cont];
                return this.userService.getAdmin().pipe(
                  catchError(() => of(null)),
                  switchMap(adminUser => {
                    const merged = [...manageableUsers, adminUser as unknown as UserProfile].filter((u, index, arr) =>
                      u && typeof u.id !== 'undefined' && arr.findIndex(x => x?.id === u.id) === index
                    );
                    return of({ allUsers: allU, chatUsers: merged });
                  })
                );
              })
            );
          }),
          catchError(() => of({ allUsers: [], chatUsers: [] }))
        ),
        plans: this.planService.getPlans().pipe(
          catchError(() => of([]))
        ),
        subs: this.subscriptionService.getAllSubscriptionsByMode('moderator').pipe(
          catchError(() => of([]))
        )
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.allUsers = result.users.allUsers;
          this.chatUsers = result.users.chatUsers;
          this.allPlans = Array.isArray(result.plans) ? result.plans : [];
          this.allSubscriptions = result.subs || [];
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
      return;
    }

    forkJoin({
      users: this.userService.getAllUsers().pipe(catchError(() => of([]))),
      plans: this.planService.getPlans().pipe(catchError(() => of([]))),
      subs: this.subscriptionService.getAllSubscriptions().pipe(catchError(() => of([])))
    })
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: (result) => {
        this.allUsers = result.users || [];
        this.chatUsers = [...this.allUsers];
        this.allPlans = result.plans || [];
        this.allSubscriptions = result.subs || [];
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  reloadAdminData(): void {
    this.loadAdminInsuranceData();
  }

  private loadProStats(): void {
    if (!this.isProfessional() || !this.currentUser?.id) return;
    this.userService.getProfessionalStats(this.currentUser.id)
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
    this.userService.getActivityFeed(this.currentUser.id)
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

  isClient(): boolean { return this.currentUser?.role === UserRole.CLIENT; }
  isProfessional(): boolean {
    const r = this.currentUser?.role;
    return r === UserRole.PERSONAL_TRAINER || r === UserRole.NUTRITIONIST;
  }
  isAdmin(): boolean { return this.currentUser?.role === UserRole.ADMIN; }
  isModerator(): boolean { return this.currentUser?.role === UserRole.MODERATOR; }
  isInsuranceManager(): boolean { return this.currentUser?.role === UserRole.INSURANCE_MANAGER; }

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
      const role = b.professionalRole === UserRole.PERSONAL_TRAINER ? 'PT' : 'Nutr.';
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

  openAvailability(): void {
    if (!this.currentUser) return;
    this.dashboardFacade.openAvailability(this.currentUser.id);
  }

  closeAvailability(): void {
    this.dashboardFacade.closeAvailability();
  }

  toggleSlot(day: Date, slot: string): void {
    if (!this.currentUser) return;
    this.dashboardFacade.toggleSlot(day, slot, this.currentUser.id);
  }

  isSlotSelected(day: Date, slot: string): boolean {
    return this.dashboardFacade.currentCalendarState.selectedSlots.has(this.availabilityService.slotKey(day, slot));
  }

  isSlotExisting(day: Date, slot: string): boolean {
    return this.dashboardFacade.currentCalendarState.existingSlots.has(this.availabilityService.slotKey(day, slot));
  }

  isSlotLocked(day: Date, slot: string): boolean {
    return this.dashboardFacade.currentCalendarState.lockedSlots.has(this.availabilityService.slotKey(day, slot));
  }

  getSelectedCount(): number {
    return this.dashboardFacade.currentCalendarState.selectedSlots.size;
  }

  confirmAvailability(): void {
    if (!this.currentUser) return;
    this.dashboardFacade.confirmAvailability(this.currentUser.id);
  }

  hasDaySlots(day: Date): boolean {
    return this.dashboardFacade.currentCalendarState.timeSlots.some(slot => this.isSlotSelected(day, slot));
  }

  get isCopyMode(): boolean {
    return this.dashboardFacade.currentCalendarState.copiedDay !== null;
  }

  isCopiedDay(day: Date): boolean {
    const state = this.dashboardFacade.currentCalendarState;
    return state.copiedDay !== null && this.availabilityService.formatDate(state.copiedDay) === this.availabilityService.formatDate(day);
  }

  copyDay(day: Date): void {
    this.dashboardFacade.copyDay(day);
  }

  clearCopy(): void {
    this.dashboardFacade.clearCopy();
  }

  pasteDay(targetDay: Date): void {
    this.dashboardFacade.pasteDay(targetDay);
  }

  getNextWeekLabel(): string {
    return this.availabilityService.getNextWeekLabel(this.dashboardFacade.currentCalendarState.nextWeekDays);
  }

  openBooking(professional: ProfessionalSummary): void {
    this.dashboardFacade.openBooking(professional);
  }

  closeBooking(): void {
    this.dashboardFacade.closeBooking();
  }

  selectBookingDay(day: Date): void {
    this.dashboardFacade.selectBookingDay(day);
  }

  getSlotTimeLabel(slot: ProfessionalSlot): string {
    return this.availabilityService.getSlotTimeLabel(slot);
  }

  toggleBookingSlot(slot: ProfessionalSlot): void {
    this.dashboardFacade.toggleBookingSlot(slot);
  }

  isBookingSlotSelected(slot: ProfessionalSlot): boolean {
    return this.dashboardFacade.currentBookingState.selectedBookingSlot?.id === slot?.id;
  }

  confirmBooking(): void {
    if (!this.currentUser) return;
    this.dashboardFacade.confirmBooking(this.currentUser.id);
  }

  isMobileChatOpen(): boolean {
    return this.activeTab === 'chat' && this.chatTabComponent?.chatView === 'conversation';
  }

  get isCallModalOpen(): boolean { return this.dashboardFacade.currentCallState.isCallModalOpen; }
  get selectedCallBooking(): Booking | null { return this.dashboardFacade.currentCallState.selectedCallBooking; }
  get canJoinCallNow(): boolean { return this.dashboardFacade.currentCallState.canJoinCallNow; }

  openCallModal(booking: Booking): void {
    this.dashboardFacade.openCallModal(booking);
  }

  closeCallModal(): void {
    this.dashboardFacade.closeCallModal();
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
        }
      });
  }

  getTotalUnread(): number {
    return this.globalUnreadCount;
  }


  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
