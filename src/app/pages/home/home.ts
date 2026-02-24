import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, RouterModule, DecimalPipe],
    templateUrl: './home.html',
    styleUrls: ['./home.css']
})
export class HomeComponent implements OnInit {
    plans: any[] = [];
    isAnnual: boolean = false; // Toggle per il periodo (false = mensile, true = annuale)

    private authService = inject(AuthService);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);

    ngOnInit(): void {
        // Caricamento dei piani all'avvio
        this.authService.getPlans().subscribe({
            next: (res) => {
                if (res && res.length > 0) {
                    // Filtriamo in modo logico: prendiamo i primi 4 piani più economici.
                    // In questo modo supportiamo 4 card, scartando i doppioni annuali/semestrali eccessivi
                    this.plans = res.sort((a: any, b: any) => a.fullPrice - b.fullPrice).slice(0, 4);
                } else {
                    // Fallback se il db è vuoto (per testing layout a 4 card)
                    this.plans = [
                        { id: 1, name: 'Base', fullPrice: 49 },
                        { id: 2, name: 'Silver', fullPrice: 69 },
                        { id: 3, name: 'Vantaggioso', fullPrice: 89 },
                        { id: 4, name: 'Premium', fullPrice: 129 }
                    ];
                }
                this.cdr.detectChanges(); // Forza il re-render
            },
            error: (err) => {
                console.error("Errore caricamento piani", err);
                // Fallback visivo se backend è irraggiungibile
                this.plans = [
                    { id: 1, name: 'Base', fullPrice: 49 },
                    { id: 2, name: 'Silver', fullPrice: 69 },
                    { id: 3, name: 'Vantaggioso', fullPrice: 89 },
                    { id: 4, name: 'Premium', fullPrice: 129 }
                ];
                this.cdr.detectChanges(); // Forza il re-render
            }
        });
    }

    // Permette di calcolare il prezzo mensile o annuale con uno scontro visuale fittizio sull'annuale
    // Assumiamo che plan.fullPrice sia il costo Base del contratto in Unica Soluzione.
    // Qui dividiamo per un numero di mesi indicativo o applichiamo una logica di display.
    getDisplayPrice(plan: any): number {
        const basePrice = plan.fullPrice || 0;
        // Semiplifichiamo: se è annuale, mostriamo il prezzo mensile equivalente scontato del 20%
        if (this.isAnnual) {
            return (basePrice * 0.8) / 12;
        }
        // Prezzo mensile pieno
        return basePrice / 12;
    }

    toggleBilling(annual: boolean): void {
        this.isAnnual = annual;
    }

    goToRegister(planId: number): void {
        // Navighiamo alla pagina di registrazione, volendo potremmo passare il planId come query param in futuro
        this.router.navigate(['/register']);
    }
}
