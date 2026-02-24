import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './home.html',
    styleUrls: ['./home.css']
})
export class HomeComponent implements OnInit {
    semestralePlans: any[] = [];
    annualePlans: any[] = [];
    isAnnual: boolean = false;

    private authService = inject(AuthService);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);

    get displayedPlans() {
        return this.isAnnual ? this.annualePlans : this.semestralePlans;
    }

    toggleBilling(isAnnual: boolean): void {
        this.isAnnual = isAnnual;
        this.cdr.detectChanges();
    }

    ngOnInit(): void {
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
                this.cdr.detectChanges(); // Forza il re-render
            },
            error: (err) => {
                console.error("Errore caricamento piani", err);
                this.semestralePlans = [];
                this.annualePlans = [];
                this.cdr.detectChanges(); // Forza il re-render
            }
        });
    }

    goToRegister(planId: number): void {
        // Navighiamo alla pagina di registrazione, volendo potremmo passare il planId come query param in futuro
        this.router.navigate(['/register']);
    }
}
