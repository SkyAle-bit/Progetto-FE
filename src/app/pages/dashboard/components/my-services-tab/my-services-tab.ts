import { Component, Input, inject, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService } from '../../../../services/auth.service';

@Component({
  selector: 'app-my-services-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-services-tab.html',
  styleUrls: ['./my-services-tab.css']
})
export class MyServicesTabComponent implements OnInit {
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private sanitizer = inject(DomSanitizer);

  @Input() currentUser: any;

  activeTab: string = 'scheda';
  docs: any[] = [];
  loading: boolean = false;
  private loadedType: string = '';

  // PDF viewer
  pdfOpen: boolean = false;
  pdfUrl: SafeResourceUrl | null = null;
  pdfName: string = '';
  pdfLoading: boolean = false;
  private blobUrl: string | null = null;

  ngOnInit(): void {
    this.loadDocs('scheda');
  }

  switchTab(tab: string): void {
    this.activeTab = tab;
    this.loadedType = ''; // Forza ricaricamento
    this.loadDocs(tab);
  }

  loadDocs(tab: string): void {
    if (!this.currentUser) return;
    const typeMap: any = { scheda: 'WORKOUT_PLAN', dieta: 'DIET_PLAN', polizza: 'INSURANCE_POLICE' };
    const type = typeMap[tab];
    if (!type || this.loadedType === type) return;
    this.loading = true;
    this.loadedType = type;
    this.authService.getClientDocumentsByType(this.currentUser.id, type).subscribe({
      next: (docs) => { this.docs = docs ?? []; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.docs = []; this.loading = false; this.cdr.detectChanges(); }
    });
  }

  viewPdf(doc: any): void {
    this.pdfLoading = true; this.pdfName = doc.fileName; this.pdfOpen = true; this.cdr.detectChanges();
    this.authService.downloadDocument(doc.id).subscribe({
      next: (blob) => {
        if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
        this.blobUrl = URL.createObjectURL(blob);
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.blobUrl);
        this.pdfLoading = false; this.cdr.detectChanges();
      },
      error: () => { this.pdfOpen = false; this.pdfLoading = false; this.cdr.detectChanges(); }
    });
  }

  closePdf(): void {
    this.pdfOpen = false; this.pdfUrl = null; this.pdfName = '';
    if (this.blobUrl) { URL.revokeObjectURL(this.blobUrl); this.blobUrl = null; }
  }

  openPdfNewTab(): void { if (this.blobUrl) window.open(this.blobUrl, '_blank'); }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  getTabIcon(tab: string): string {
    switch (tab) { case 'scheda': return '💪'; case 'dieta': return '🥗'; case 'polizza': return '🛡️'; default: return '📄'; }
  }

  getTabLabel(tab: string): string {
    switch (tab) { case 'scheda': return 'Scheda'; case 'dieta': return 'Dieta'; case 'polizza': return 'Polizza'; default: return tab; }
  }
}

