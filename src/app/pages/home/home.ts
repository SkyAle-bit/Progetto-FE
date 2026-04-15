import { Component, inject, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, ElementRef, NgZone, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { PlanService } from '../../services/plan.service';
import { environment } from '../../../environments/environment';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, RouterModule, ReactiveFormsModule],
    templateUrl: './home.html',
    styleUrls: ['./home.css']
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
    semestralePlans: any[] = [];
    annualePlans: any[] = [];
    isAnnual: boolean = false;
    isMobileMenuOpen: boolean = false;
    isNavScrolled: boolean = false;
    showBackToTop: boolean = false;

    @ViewChild('carouselVideo') carouselVideoRef?: ElementRef<HTMLVideoElement>;
    @ViewChild('heroVideo') heroVideoRef?: ElementRef<HTMLVideoElement>;
    @ViewChild('progressBar') progressBarRef?: ElementRef<HTMLDivElement>;

    carouselVideos = [
        { key: 'dashboard', title: 'Dashboard', src: 'https://res.cloudinary.com/dpgixeqq0/video/upload/v1774348830/dashboard_d9kgl5.mp4', mobileSrc: 'https://res.cloudinary.com/dpgixeqq0/video/upload/v1774348533/dashboard_rbs4pz.mp4' },
        { key: 'calendario', title: 'Calendario', src: 'https://res.cloudinary.com/dpgixeqq0/video/upload/v1774348830/calendario_axbrqh.mp4', mobileSrc: 'https://res.cloudinary.com/dpgixeqq0/video/upload/v1774348532/chat_rfr9oh.mp4' },
        { key: 'prenotazione', title: 'Prenotazione', src: 'https://res.cloudinary.com/dpgixeqq0/video/upload/v1774348830/prenotazione_hqiaw1.mp4', mobileSrc: 'https://res.cloudinary.com/dpgixeqq0/video/upload/v1774348534/prenotazione_eq54m3.mp4' },
        { key: 'chat', title: 'Chat', src: 'https://res.cloudinary.com/dpgixeqq0/video/upload/v1774348830/chat_godpbw.mp4', mobileSrc: 'https://res.cloudinary.com/dpgixeqq0/video/upload/v1774348532/chat_rfr9oh.mp4' },
        { key: 'scheda', title: 'Scheda', src: 'https://res.cloudinary.com/dpgixeqq0/video/upload/v1774348836/scheda_mgbfxb.mp4', mobileSrc: 'https://res.cloudinary.com/dpgixeqq0/video/upload/v1774348534/scheda_sr3hsi.mp4' }
    ];
    currentCarouselVideoIndex: number = 0;
    videoProgress: number = 0;
    isCarouselPlaying: boolean = false;

    getVideoSrc(video: any): string {
        return window.innerWidth < 640 ? video.mobileSrc : video.src;
    }
    private readonly maxCarouselAutoplayRetries = 6;
    private carouselSectionObserver!: IntersectionObserver;
    private hasCarouselStarted: boolean = false;
    private lastIsMobile: boolean = window.innerWidth < 640;

    @HostListener('window:resize')
    onResize(): void {
        const isMobileObj = window.innerWidth < 640;
        if (this.lastIsMobile !== isMobileObj) {
            this.lastIsMobile = isMobileObj;
            if (this.hasCarouselStarted) {
                this.playCurrentCarouselVideo();
            }
        }
    }

    // FAQ
    openFaqIndex: number = -1;
    faqItems = [
        {
            question: 'Come funziona il sistema di crediti per le sessioni?',
            answer: 'Ogni piano include un numero mensile di crediti per sessioni con Personal Trainer e Nutrizionista. I crediti si rinnovano ogni mese e puoi prenotare le sessioni direttamente dalla piattaforma in base alla tua disponibilità.'
        },
        {
            question: 'Posso cambiare piano in qualsiasi momento?',
            answer: 'Sì, puoi effettuare l\'upgrade o il downgrade del tuo piano in qualsiasi momento. La differenza di prezzo verrà calcolata in modo proporzionale al periodo rimanente del tuo abbonamento attuale.'
        },
        {
            question: 'Come vengono personalizzati gli allenamenti?',
            answer: 'Il tuo Personal Trainer analizzerà il tuo livello di partenza, i tuoi obiettivi e la tua disponibilità per creare un programma totalmente su misura. Il piano viene aggiornato mensilmente in base ai tuoi progressi reali.'
        },
        {
            question: 'Il piano alimentare tiene conto di intolleranze e preferenze?',
            answer: 'Assolutamente sì. Il nostro Nutrizionista crea piani alimentari personalizzati che rispettano intolleranze, allergie, preferenze alimentari e il tuo stile di vita, garantendo sempre un approccio sostenibile.'
        },
        {
            question: 'Cosa include la polizza assicurativa sportiva?',
            answer: 'Ogni membro Kore è coperto da una polizza assicurativa sportiva che protegge durante l\'attività fisica. La copertura è inclusa in tutti i piani senza costi aggiuntivi.'
        }
    ];

    // Form candidatura
    applicationForm!: FormGroup;
    selectedFile: File | null = null;
    fileError: string = '';
    isSubmitting: boolean = false;
    submitSuccess: boolean = false;
    submitError: string = '';
    isDragging: boolean = false;

    private authService = inject(AuthService);
    private planService = inject(PlanService);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private fb = inject(FormBuilder);
    private http = inject(HttpClient);
    private el = inject(ElementRef);
    private zone = inject(NgZone);

    private revealObserver!: IntersectionObserver;
    private counterObserver!: IntersectionObserver;
    private scrollListener!: () => void;

    get displayedPlans() {
        return this.isAnnual ? this.annualePlans : this.semestralePlans;
    }

    toggleBilling(isAnnual: boolean): void {
        this.isAnnual = isAnnual;
        this.cdr.detectChanges();
        setTimeout(() => this.observeNewRevealElements(), 0);
    }

    toggleMobileMenu(): void {
        this.isMobileMenuOpen = !this.isMobileMenuOpen;
    }

    closeMobileMenu(): void {
        this.isMobileMenuOpen = false;
    }

    toggleFaq(index: number): void {
        this.openFaqIndex = this.openFaqIndex === index ? -1 : index;
    }

    ngOnInit(): void {

        this.applicationForm = this.fb.group({
            firstName: ['', Validators.required],
            lastName: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            role: ['', Validators.required],
            message: ['', Validators.required]
        });


        this.planService.getPlans().subscribe({
            next: (res) => {
                if (res && res.length > 0) {
                    this.semestralePlans = res.filter((p: any) => p.duration === 'SEMESTRALE');
                    this.annualePlans = res.filter((p: any) => p.duration === 'ANNUALE');
                } else {
                    this.semestralePlans = [];
                    this.annualePlans = [];
                }
                this.cdr.detectChanges();
                setTimeout(() => this.observeNewRevealElements(), 0);
            },
            error: (err) => {
                console.error("Errore caricamento piani", err);
                this.semestralePlans = [];
                this.annualePlans = [];
                this.cdr.detectChanges();
            }
        });
    }

    ngAfterViewInit(): void {
        this.zone.runOutsideAngular(() => {
            this.initScrollReveal();
            this.initCounterAnimation();
            this.initScrollEffects();

            setTimeout(() => {
                if (this.heroVideoRef && this.heroVideoRef.nativeElement) {
                    this.heroVideoRef.nativeElement.muted = true;
                    this.heroVideoRef.nativeElement.play().catch(e => console.warn('Hero video autoplay prevented:', e));
                }
            }, 50);
        });

        setTimeout(() => this.initCarouselSectionObserver(), 0);
    }

    ngOnDestroy(): void {
        if (this.revealObserver) this.revealObserver.disconnect();
        if (this.counterObserver) this.counterObserver.disconnect();
        if (this.carouselSectionObserver) this.carouselSectionObserver.disconnect();
        const container = this.el.nativeElement.querySelector('.home-page');
        if (container && this.scrollListener) {
            container.removeEventListener('scroll', this.scrollListener);
        }
    }

    // ── Scroll Reveal ──
    private initScrollReveal(): void {
        this.revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    (entry.target as HTMLElement).classList.add('revealed');
                    this.revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });

        this.observeNewRevealElements();
    }

    private observeNewRevealElements(): void {
        if (!this.revealObserver || !this.el?.nativeElement) return;
        const elements = this.el.nativeElement.querySelectorAll('[data-reveal]:not(.revealed)');
        elements.forEach((el: HTMLElement) => this.revealObserver.observe(el));
    }

    // ── Counter Animation ──
    private initCounterAnimation(): void {
        this.counterObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.animateCounter(entry.target as HTMLElement);
                    this.counterObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        const counters = this.el.nativeElement.querySelectorAll('[data-counter]');
        counters.forEach((el: HTMLElement) => this.counterObserver.observe(el));
    }

    private animateCounter(el: HTMLElement): void {
        const target = parseInt(el.getAttribute('data-counter') || '0', 10);
        const suffix = el.getAttribute('data-counter-suffix') || '';
        const duration = 1500;
        const startTime = performance.now();

        const step = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(eased * target);
            el.textContent = current + suffix;
            if (progress < 1) {
                requestAnimationFrame(step);
            }
        };
        requestAnimationFrame(step);
    }

    // ── Scroll Effects (sticky navbar + parallax) ──
    private initScrollEffects(): void {
        const container = this.el.nativeElement.querySelector('.home-page');
        if (!container) return;

        const header = this.el.nativeElement.querySelector('.home-header');
        const parallaxElements = this.el.nativeElement.querySelectorAll('[data-parallax]');

        this.scrollListener = () => {
            const scrollTop = container.scrollTop;
            const scrollHeight = container.scrollHeight - container.clientHeight;
            const scrollPercentage = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;

            if (this.progressBarRef) {
                this.progressBarRef.nativeElement.style.width = scrollPercentage + '%';
            }

            // Update angular bindings inside NgZone
            this.zone.run(() => {
                this.isNavScrolled = scrollTop > 10;
                this.showBackToTop = scrollTop > 500;
            });

            // Sticky navbar effect
            if (header) {
                if (scrollTop > 10) {
                    header.classList.add('scrolled');
                } else {
                    header.classList.remove('scrolled');
                }
            }

            // Parallax effect
            parallaxElements.forEach((el: HTMLElement) => {
                const speed = parseFloat(el.getAttribute('data-parallax') || '0.3');
                el.style.transform = `translateY(${scrollTop * speed}px)`;
            });
        };

        container.addEventListener('scroll', this.scrollListener, { passive: true });
    }

    scrollToTop(): void {
        const container = this.el.nativeElement.querySelector('.home-page');
        if (container) {
            container.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    goToRegister(planId: number): void {
        this.router.navigate(['/register'], { queryParams: { plan: planId } });
    }

    // ── Carousel Section Observer ──
    private initCarouselSectionObserver(): void {
        const section = this.el.nativeElement.querySelector('.experience-carousel-section');
        if (!section) return;

        this.carouselSectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !this.hasCarouselStarted) {
                    this.hasCarouselStarted = true;
                    this.zone.run(() => this.playCurrentCarouselVideo());
                    this.carouselSectionObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });

        this.carouselSectionObserver.observe(section);
    }

    nextCarouselVideo(): void {
        this.currentCarouselVideoIndex = (this.currentCarouselVideoIndex + 1) % this.carouselVideos.length;
        this.videoProgress = 0;
        this.playCurrentCarouselVideo();
    }

    previousCarouselVideo(): void {
        this.currentCarouselVideoIndex =
            (this.currentCarouselVideoIndex - 1 + this.carouselVideos.length) % this.carouselVideos.length;
        this.videoProgress = 0;
        this.playCurrentCarouselVideo();
    }

    selectCarouselVideo(index: number): void {
        if (index < 0 || index >= this.carouselVideos.length || index === this.currentCarouselVideoIndex) {
            return;
        }

        this.currentCarouselVideoIndex = index;
        this.videoProgress = 0;
        this.playCurrentCarouselVideo();
    }

    onCarouselVideoEnded(): void {
        this.nextCarouselVideo();
    }

    onCarouselPlayClick(): void {
        this.isCarouselPlaying = true;
        this.playCurrentCarouselVideo();
    }

    onVideoTimeUpdate(): void {
        const videoEl = this.carouselVideoRef?.nativeElement;
        if (!videoEl || !videoEl.duration) return;
        this.videoProgress = (videoEl.currentTime / videoEl.duration) * 100;
    }

    getCardTransform(index: number): string {
        const diff = index - this.currentCarouselVideoIndex;
        const offset = diff * 8;
        return `translateX(${offset}px)`;
    }

    getCardOpacity(index: number): number {
        const dist = Math.abs(index - this.currentCarouselVideoIndex);
        if (dist === 0) return 1;
        return Math.max(0.45, 1 - dist * 0.2);
    }

    private playCurrentCarouselVideo(retryCount: number = 0): void {
        this.cdr.detectChanges();

        queueMicrotask(() => {
            const videoEl = this.carouselVideoRef?.nativeElement;
            if (!videoEl) {
                return;
            }


            videoEl.muted = true;
            videoEl.defaultMuted = true;
            videoEl.playsInline = true;
            videoEl.autoplay = true;

            videoEl.load();
            videoEl.play().then(() => {
                this.isCarouselPlaying = true;
                this.cdr.detectChanges();
            }).catch(() => {

                if (retryCount < this.maxCarouselAutoplayRetries) {
                    setTimeout(() => this.playCurrentCarouselVideo(retryCount + 1), 180);
                }
            });
        });
    }

    // ── File handling ──

    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            this.validateAndSetFile(input.files[0]);
        }
    }

    onDragOver(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.isDragging = true;
    }

    onDragLeave(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.isDragging = false;
    }

    onDrop(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.isDragging = false;
        if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
            this.validateAndSetFile(event.dataTransfer.files[0]);
        }
    }

    private validateAndSetFile(file: File): void {
        this.fileError = '';
        if (file.type !== 'application/pdf') {
            this.fileError = 'Il file deve essere in formato PDF.';
            this.selectedFile = null;
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            this.fileError = 'Il file non può superare i 10MB.';
            this.selectedFile = null;
            return;
        }
        this.selectedFile = file;
    }

    // ── Submit ──

    submitApplication(): void {
        if (this.applicationForm.invalid) {
            this.applicationForm.markAllAsTouched();
            return;
        }

        this.isSubmitting = true;
        this.submitError = '';

        const formData = new FormData();


        const jsonBlob = new Blob([JSON.stringify(this.applicationForm.value)], { type: 'application/json' });
        formData.append('data', jsonBlob);

        if (this.selectedFile) {
            formData.append('cv', this.selectedFile);
        }

        this.http.post(`${environment.apiUrl}/api/job-applications`, formData).subscribe({
            next: () => {
                this.isSubmitting = false;
                this.submitSuccess = true;
                this.cdr.detectChanges();
            },
            error: (err) => {
                this.isSubmitting = false;
                this.submitError = err.error?.message || 'Si è verificato un errore. Riprova più tardi.';
                this.cdr.detectChanges();
            }
        });
    }
}
