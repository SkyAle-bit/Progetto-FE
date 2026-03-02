import { Component, Input, Output, EventEmitter, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../services/auth.service';

@Component({
  selector: 'app-clients-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './clients-tab.html',
  styleUrls: ['./clients-tab.css']
})
export class ClientsTabComponent {
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  @Input() myClients: any[] = [];
  @Input() currentUser: any;
  @Output() showPopup = new EventEmitter<{title: string, message: string}>();

  selectedClient: any = null;
  clientDocuments: any[] = [];
  clientDocsLoading: boolean = false;
  docFilterType: string = 'ALL';
  isUploading: boolean = false;

  openClientDetail(client: any): void {
    this.selectedClient = client;
    this.clientDocuments = [];
    this.docFilterType = 'ALL';
    this.loadClientDocuments();
  }

  closeClientDetail(): void {
    this.selectedClient = null;
    this.clientDocuments = [];
  }

  loadClientDocuments(): void {
    if (!this.selectedClient) return;
    this.clientDocsLoading = true;
    const clientId = this.selectedClient.id;
    const obs = this.docFilterType === 'ALL'
      ? this.authService.getClientDocuments(clientId)
      : this.authService.getClientDocumentsByType(clientId, this.docFilterType);
    obs.subscribe({
      next: (docs) => { this.clientDocuments = docs; this.clientDocsLoading = false; this.cdr.detectChanges(); },
      error: () => { this.clientDocsLoading = false; this.cdr.detectChanges(); }
    });
  }

  onDocFilterChange(type: string): void {
    this.docFilterType = type;
    this.loadClientDocuments();
  }

  onFileSelected(event: Event, type: string): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0 || !this.selectedClient) return;
    const file = input.files[0];
    if (file.type !== 'application/pdf') { this.showPopup.emit({title: 'Errore', message: 'Puoi caricare solo file PDF.'}); input.value = ''; return; }
    if (file.size > 10 * 1024 * 1024) { this.showPopup.emit({title: 'Errore', message: 'Il file non può superare i 10MB.'}); input.value = ''; return; }
    this.isUploading = true;
    this.authService.uploadDocument(file, this.selectedClient.id, this.currentUser.id, type).subscribe({
      next: () => { this.isUploading = false; this.showPopup.emit({title: 'Caricato!', message: `${type === 'WORKOUT_PLAN' ? 'Scheda' : 'Dieta'} caricata con successo.`}); this.loadClientDocuments(); input.value = ''; },
      error: () => { this.isUploading = false; this.showPopup.emit({title: 'Errore', message: 'Impossibile caricare il file. Riprova.'}); input.value = ''; }
    });
  }

  viewDocument(doc: any): void {
    this.authService.downloadDocument(doc.id).subscribe({
      next: (blob) => { const url = URL.createObjectURL(blob); window.open(url, '_blank'); },
      error: () => { this.showPopup.emit({title: 'Errore', message: 'Impossibile aprire il documento.'}); }
    });
  }

  deleteDoc(doc: any): void {
    if (!confirm(`Eliminare "${doc.fileName}"?`)) return;
    this.authService.deleteDocument(doc.id).subscribe({
      next: () => { this.loadClientDocuments(); },
      error: () => { this.showPopup.emit({title: 'Errore', message: 'Impossibile eliminare il documento.'}); }
    });
  }

  getDocTypeLabel(type: string): string {
    switch (type) { case 'WORKOUT_PLAN': return 'Scheda'; case 'DIET_PLAN': return 'Dieta'; case 'MEDICAL_CERT': return 'Certificato'; case 'INSURANCE_POLICE': return 'Polizza'; default: return type; }
  }

  getDocTypeIcon(type: string): string {
    switch (type) { case 'WORKOUT_PLAN': return '💪'; case 'DIET_PLAN': return '🥗'; case 'MEDICAL_CERT': return '🏥'; case 'INSURANCE_POLICE': return '📋'; default: return '📄'; }
  }

  formatDocDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
