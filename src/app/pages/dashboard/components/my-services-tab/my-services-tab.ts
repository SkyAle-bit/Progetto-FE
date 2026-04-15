import { Component, Input, inject, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DocumentService } from '../../../../services/document.service';

@Component({
  selector: 'app-my-services-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-services-tab.html',
  styleUrls: ['./my-services-tab.css']
})
export class MyServicesTabComponent implements OnInit {
  private documentService = inject(DocumentService);
  private cdr = inject(ChangeDetectorRef);
  private sanitizer = inject(DomSanitizer);

  @Input() currentUser: any;

  activeTab: string = 'scheda';
  docs: any[] = [];
  loading: boolean = false;
  private loadedType: string = '';

  get isMobile(): boolean {
    return window.innerWidth < 640;
  }

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
    this.documentService.getClientDocumentsByType(this.currentUser.id, type).subscribe({
      next: (docs) => { this.docs = docs ?? []; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.docs = []; this.loading = false; this.cdr.detectChanges(); }
    });
  }

  viewPdf(doc: any): void {
    this.pdfLoading = true; this.pdfName = doc.fileName; this.pdfOpen = true; this.cdr.detectChanges();
    this.documentService.downloadDocument(doc.id).subscribe({
      next: (blob) => {
        if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
        this.blobUrl = URL.createObjectURL(blob);
        // Su mobile, apri direttamente in un nuovo tab
        if (this.isMobile) {
          window.open(this.blobUrl, '_blank');
          this.pdfOpen = false; this.pdfLoading = false; this.cdr.detectChanges();
        } else {
          this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.blobUrl + '#view=FitH&zoom=page-width');
          this.pdfLoading = false; this.cdr.detectChanges();
        }
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

