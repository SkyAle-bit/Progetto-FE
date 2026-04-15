import { Component, Input, Output, EventEmitter, OnChanges, OnInit, SimpleChanges, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReviewService, ReviewResponse } from '../../../../services/review.service';

@Component({
    selector: 'app-my-professionals-tab',
    standalone: true,
    imports: [CommonModule, FormsModule, DecimalPipe],
    templateUrl: './my-professionals-tab.html',
    styleUrls: ['./my-professionals-tab.css']
})
export class MyProfessionalsTabComponent implements OnChanges, OnInit {
    @Input() professionals: any[] = [];
    @Input() currentUser: any = null;
    @Output() bookProfessional = new EventEmitter<any>();

    private reviewService = inject(ReviewService);
    private cdr = inject(ChangeDetectorRef);

    /** Recensioni pubbliche per professionalId */
    reviewsMap: Record<number, ReviewResponse[]> = {};
    /** Il backend dice che l'utente ha già recensito (fonte di verità) */
    hasReviewedServerMap: Record<number, boolean> = {};
    /** Contenuto della recensione dell'utente, estratto dalla lista pubblica */
    hasReviewedMap: Record<number, ReviewResponse | null> = {};
    /** Il backend dice che l'utente PUÒ ancora recensire */
    canReviewMap: Record<number, boolean> = {};

    // Modal recensioni pubbliche
    publicReviewsModal: { prof: any; reviews: ReviewResponse[] } | null = null;

    // Form recensione
    reviewFormOpen: Record<number, boolean> = {};
    reviewRating: Record<number, number> = {};
    reviewComment: Record<number, string> = {};
    reviewSubmitting: Record<number, boolean> = {};
    reviewSuccess: Record<number, boolean> = {};
    reviewError: Record<number, string | null> = {};

    ngOnInit(): void {
        if (this.professionals?.length && this.currentUser?.id) {
            this.loadReviewData();
        }
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (this.professionals?.length && this.currentUser?.id) {
            this.loadReviewData();
        }
    }

    loadReviewData(): void {
        this.professionals.forEach(p => {
            // Inizializza form solo la prima volta
            if (this.reviewRating[p.id] === undefined) {
                this.reviewRating[p.id] = 5;
                this.reviewComment[p.id] = '';
            }

            // Retrieve authoritative state from backend
            this.reviewService.canReview(this.currentUser.id, p.id).subscribe(r => {
                this.canReviewMap[p.id] = r.canReview;
                this.hasReviewedServerMap[p.id] = r.hasReviewed;
                this.cdr.detectChanges();
            });

            // Load public reviews computing average rating and personal submission
            this.reviewService.getReviewsForProfessional(p.id).subscribe(reviews => {
                this.reviewsMap[p.id] = reviews;
                const mine = reviews.find(r => r.authorName === this.currentUser.firstName);
                this.hasReviewedMap[p.id] = mine ?? null;
                this.cdr.detectChanges();
            });
        });
    }

    openPublicReviews(prof: any): void {
        this.publicReviewsModal = { prof, reviews: this.reviewsMap[prof.id] ?? [] };
    }

    closePublicReviews(): void {
        this.publicReviewsModal = null;
    }

    toggleReviewForm(profId: number): void {
        this.reviewFormOpen[profId] = !this.reviewFormOpen[profId];
        this.reviewError[profId] = null;
    }

    setRating(profId: number, val: number): void {
        this.reviewRating[profId] = val;
    }

    submitReview(prof: any): void {
        const rating = this.reviewRating[prof.id] ?? 5;
        const comment = (this.reviewComment[prof.id] ?? '').trim();
        if (!comment) { this.reviewError[prof.id] = 'Scrivi un commento prima di inviare.'; return; }

        this.reviewSubmitting[prof.id] = true;
        this.reviewError[prof.id] = null;
        this.reviewService.addReview(this.currentUser.id, prof.id, rating, comment).subscribe({
            next: (saved) => {
                this.reviewSuccess[prof.id] = true;
                this.reviewSubmitting[prof.id] = false;
                this.reviewFormOpen[prof.id] = false;
                this.hasReviewedMap[prof.id] = saved;
                this.hasReviewedServerMap[prof.id] = true;
                this.canReviewMap[prof.id] = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                this.reviewSubmitting[prof.id] = false;
                this.reviewError[prof.id] = err?.error?.message || 'Errore durante l\'invio. Riprova.';
                this.cdr.detectChanges();
            }
        });
    }

    getStars(count: number): number[] {
        return Array.from({ length: count }, (_, i) => i + 1);
    }

    getAvgRating(reviews: ReviewResponse[]): number {
        if (!reviews?.length) return 0;
        return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    }

    getDaysUntilReview(): string {
        if (!this.currentUser?.createdAt) return '30';
        const reg = new Date(this.currentUser.createdAt);
        const canAt = new Date(reg);
        canAt.setMonth(canAt.getMonth() + 1);
        const now = new Date();
        const diff = Math.ceil((canAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diff > 0 ? diff.toString() : '0';
    }
}
