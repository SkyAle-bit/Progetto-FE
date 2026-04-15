import { Component, Input, Output, EventEmitter, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DocumentService } from '../../../../services/document.service';

@Component({
  selector: 'app-clients-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './clients-tab.html',
  styleUrls: ['./clients-tab.css']
})
export class ClientsTabComponent {
  private authService = inject(DocumentService);
  private cdr = inject(ChangeDetectorRef);
  private sanitizer = inject(DomSanitizer);

  @Input() myClients: any[] = [];
  @Input() currentUser: any;
  @Output() showPopup = new EventEmitter<{title: string, message: string}>();

  selectedClient: any = null;
  clientDocuments: any[] = [];
  clientDocsLoading: boolean = false;
  docFilterType: string = 'ALL';
  isUploading: boolean = false;

  // Drag & Drop
  isDragOver: boolean = false;
  dragCounter: number = 0;

  // Notes editing
  editingNotesDocId: number | null = null;
  editingNotesText: string = '';
  savingNotes: boolean = false;

  // PDF Viewer inline
  pdfViewerOpen: boolean = false;
  pdfViewerUrl: SafeResourceUrl | null = null;
  pdfViewerFileName: string = '';
  pdfViewerLoading: boolean = false;
  private currentBlobUrl: string | null = null;

  get isMobile(): boolean {
    return window.innerWidth < 640;
  }

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

  // ── Drag & Drop ──────────────────────────────────────────

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragCounter++;
    if (event.dataTransfer?.types.includes('Files')) {
      this.isDragOver = true;
      this.cdr.detectChanges();
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragCounter--;
    if (this.dragCounter === 0) {
      this.isDragOver = false;
      this.cdr.detectChanges();
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    this.dragCounter = 0;
    this.cdr.detectChanges();

    if (this.isUploading || !this.selectedClient) return;

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    if (file.type !== 'application/pdf') {
      this.showPopup.emit({ title: 'Errore', message: 'Puoi caricare solo file PDF.' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.showPopup.emit({ title: 'Errore', message: 'Il file non può superare i 10MB.' });
      return;
    }

    // Determina il tipo di documento in base al ruolo
    const type = this.getUploadType();
    if (!type) return;

    this.isUploading = true;
    this.cdr.detectChanges();
    this.authService.uploadDocument(file, this.selectedClient.id, this.currentUser.id, type).subscribe({
      next: () => {
        this.isUploading = false;
        this.showPopup.emit({ title: 'Caricato!', message: `${type === 'WORKOUT_PLAN' ? 'Scheda' : 'Dieta'} caricata con successo.` });
        this.loadClientDocuments();
        this.cdr.detectChanges();
      },
      error: () => {
        this.isUploading = false;
        this.showPopup.emit({ title: 'Errore', message: 'Impossibile caricare il file. Riprova.' });
        this.cdr.detectChanges();
      }
    });
  }

  getUploadType(): string | null {
    if (this.currentUser?.role === 'PERSONAL_TRAINER') return 'WORKOUT_PLAN';
    if (this.currentUser?.role === 'NUTRITIONIST') return 'DIET_PLAN';
    return null;
  }

  getDropzoneLabel(): string {
    if (this.currentUser?.role === 'PERSONAL_TRAINER') return 'Trascina qui una scheda PDF';
    if (this.currentUser?.role === 'NUTRITIONIST') return 'Trascina qui una dieta PDF';
    return 'Trascina qui un PDF';
  }

  viewDocument(doc: any): void {
    this.pdfViewerLoading = true;
    this.pdfViewerFileName = doc.fileName;
    this.pdfViewerOpen = true;
    this.cdr.detectChanges();

    this.authService.downloadDocument(doc.id).subscribe({
      next: (blob) => {
        // Revoca URL precedente se esiste
        if (this.currentBlobUrl) URL.revokeObjectURL(this.currentBlobUrl);
        this.currentBlobUrl = URL.createObjectURL(blob);
        // Su mobile, apri direttamente in un nuovo tab
        if (this.isMobile) {
          window.open(this.currentBlobUrl, '_blank');
          this.pdfViewerOpen = false; this.pdfViewerLoading = false; this.cdr.detectChanges();
        } else {
          this.pdfViewerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.currentBlobUrl + '#view=FitH&zoom=page-width');
          this.pdfViewerLoading = false;
          this.cdr.detectChanges();
        }
      },
      error: () => {
        this.pdfViewerOpen = false;
        this.pdfViewerLoading = false;
        this.showPopup.emit({title: 'Errore', message: 'Impossibile aprire il documento.'});
        this.cdr.detectChanges();
      }
    });
  }

  closePdfViewer(): void {
    this.pdfViewerOpen = false;
    this.pdfViewerUrl = null;
    this.pdfViewerFileName = '';
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
  }

  openPdfInNewTab(): void {
    if (this.currentBlobUrl) window.open(this.currentBlobUrl, '_blank');
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

  /** PT può caricare solo schede */
  canUploadWorkout(): boolean {
    return this.currentUser?.role === 'PERSONAL_TRAINER';
  }

  /** Nutrizionista può caricare solo diete */
  canUploadDiet(): boolean {
    return this.currentUser?.role === 'NUTRITIONIST';
  }

  /** Si può eliminare solo il tipo di documento che il proprio ruolo può caricare */
  canDeleteDoc(doc: any): boolean {
    if (this.currentUser?.role === 'PERSONAL_TRAINER') return doc.type === 'WORKOUT_PLAN';
    if (this.currentUser?.role === 'NUTRITIONIST') return doc.type === 'DIET_PLAN';
    return false;
  }

  /** Il professionista può modificare le note solo per il tipo di doc che gli compete */
  canEditNotes(doc: any): boolean {
    if (this.currentUser?.role === 'PERSONAL_TRAINER') return doc.type === 'WORKOUT_PLAN';
    if (this.currentUser?.role === 'NUTRITIONIST') return doc.type === 'DIET_PLAN';
    return false;
  }

  toggleNotesEdit(doc: any): void {
    if (this.editingNotesDocId === doc.id) {
      this.editingNotesDocId = null;
      this.editingNotesText = '';
    } else {
      this.editingNotesDocId = doc.id;
      this.editingNotesText = doc.notes || '';
    }
  }

  saveNotes(doc: any): void {
    this.savingNotes = true;
    this.authService.updateDocumentNotes(doc.id, this.editingNotesText).subscribe({
      next: () => {
        doc.notes = this.editingNotesText;
        this.editingNotesDocId = null;
        this.editingNotesText = '';
        this.savingNotes = false;
        this.showPopup.emit({ title: 'Salvato!', message: 'Appunti aggiornati con successo.' });
        this.cdr.detectChanges();
      },
      error: () => {
        this.savingNotes = false;
        this.showPopup.emit({ title: 'Errore', message: 'Impossibile salvare gli appunti.' });
        this.cdr.detectChanges();
      }
    });
  }
}
