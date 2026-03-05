import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ReviewResponse {
    authorName: string;
    rating: number;
    comment: string;
    date: string;
}

@Injectable({
    providedIn: 'root'
})
export class ReviewService {
    private http = inject(HttpClient);
    private apiUrl = environment.apiUrl;

    getReviewsForProfessional(professionalId: number): Observable<ReviewResponse[]> {
        return this.http.get<ReviewResponse[]>(`${this.apiUrl}/api/reviews/professional/${professionalId}`).pipe(
            catchError(() => of([]))
        );
    }

    canReview(clientId: number, professionalId: number): Observable<{ canReview: boolean; hasReviewed: boolean }> {
        return this.http.get<{ canReview: boolean; hasReviewed: boolean }>(
            `${this.apiUrl}/api/reviews/can-review?clientId=${clientId}&professionalId=${professionalId}`
        ).pipe(catchError(() => of({ canReview: false, hasReviewed: false })));
    }

    addReview(clientId: number, professionalId: number, rating: number, comment: string): Observable<ReviewResponse> {
        return this.http.post<ReviewResponse>(`${this.apiUrl}/api/reviews`, {
            userId: clientId,
            professionalId,
            rating,
            comment
        });
    }
}
