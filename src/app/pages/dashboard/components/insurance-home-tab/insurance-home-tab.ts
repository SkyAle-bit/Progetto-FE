import { Component, Input, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService } from '../../../../services/auth.service';

@Component({
  selector: 'app-insurance-home-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './insurance-home-tab.html',
  styleUrls: ['./insurance-home-tab.css']
})
export class InsuranceHomeTabComponent {
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private sanitizer = inject(DomSanitizer);

  @Input() currentUser: any;
  @Input() allSubscriptions: any[] = [];
  @Input() allUsers: any[] = [];

  searchQuery: string = '';
  selectedClient: any = null;
  clientDocs: any[] = [];
  docsLoading: boolean = false;

  // PDF viewer
  pdfOpen: boolean = false;
  pdfUrl: SafeResourceUrl | null = null;
  pdfName: string = '';
  pdfLoading: boolean = false;
  private blobUrl: string | null = null;

  get activePolicies(): number { return this.allSubscriptions.filter(s => s.active).length; }
  get coveredClients(): any[] {
    return this.allSubscriptions.filter(s => s.active).map(s => ({
      ...s,
      user: this.allUsers.find(u => u.id === s.userId)
    })).filter(s => s.user);
  }
  get filteredClients(): any[] {
    if (!this.searchQuery.trim()) return this.coveredClients;
    const q = this.searchQuery.toLowerCase();
    return this.coveredClients.filter(c =>
      (c.user.firstName + ' ' + c.user.lastName).toLowerCase().includes(q) ||
      c.user.email?.toLowerCase().includes(q)
    );
  }

  getInitials(): string {
    return ((this.currentUser?.firstName ?? '').charAt(0) + (this.currentUser?.lastName ?? '').charAt(0)).toUpperCase();
  }

  openClientDocs(sub: any): void {
    this.selectedClient = sub;
    this.docsLoading = true;
    this.authService.getClientDocumentsByType(sub.userId, 'INSURANCE_POLICE').subscribe({
      next: (docs) => { this.clientDocs = docs; this.docsLoading = false; this.cdr.detectChanges(); },
      error: () => { this.clientDocs = []; this.docsLoading = false; this.cdr.detectChanges(); }
    });
  }

  closeClientDocs(): void { this.selectedClient = null; this.clientDocs = []; }

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

  formatDate(d: string): string { return new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }); }
}
