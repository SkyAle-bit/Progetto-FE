import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, RouterModule, ReactiveFormsModule],
    templateUrl: './home.html',
    styleUrls: ['./home.css']
})
export class HomeComponent implements OnInit {
    semestralePlans: any[] = [];
    annualePlans: any[] = [];
    isAnnual: boolean = false;

    // Form candidatura
    applicationForm!: FormGroup;
    selectedFile: File | null = null;
    fileError: string = '';
    isSubmitting: boolean = false;
    submitSuccess: boolean = false;
    submitError: string = '';

    private authService = inject(AuthService);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private fb = inject(FormBuilder);
    private http = inject(HttpClient);

    get displayedPlans() {
        return this.isAnnual ? this.annualePlans : this.semestralePlans;
    }

    toggleBilling(isAnnual: boolean): void {
        this.isAnnual = isAnnual;
        this.cdr.detectChanges();
    }

    ngOnInit(): void {
        // Inizializzazione form candidatura
        this.applicationForm = this.fb.group({
            firstName: ['', Validators.required],
            lastName: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            role: ['', Validators.required],
            message: ['', Validators.required]
        });

        // Caricamento dei piani all'avvio
        this.authService.getPlans().subscribe({
            next: (res) => {
                if (res && res.length > 0) {
                    this.semestralePlans = res.filter((p: any) => p.duration === 'SEMESTRALE');
                    this.annualePlans = res.filter((p: any) => p.duration === 'ANNUALE');
                } else {
                    this.semestralePlans = [];
                    this.annualePlans = [];
                }
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error("Errore caricamento piani", err);
                this.semestralePlans = [];
                this.annualePlans = [];
                this.cdr.detectChanges();
            }
        });
    }

    goToRegister(planId: number): void {
        this.router.navigate(['/register']);
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
    }

    onDrop(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
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

        // Aggiungiamo i dati JSON come Blob con content-type application/json
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
