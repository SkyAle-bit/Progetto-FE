import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  uploadDocument(file: File, clientId: number, uploaderId: number, type: string): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('clientId', clientId.toString());
    formData.append('uploaderId', uploaderId.toString());
    formData.append('type', type);
    return this.http.post(`${this.apiUrl}/api/documents/upload`, formData);
  }

  getClientDocuments(clientId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/documents/user/${clientId}`);
  }

  getClientDocumentsByType(clientId: number, type: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/documents/user/${clientId}/type/${type}`);
  }

  getDocumentDownloadUrl(documentId: number): string {
    return `${this.apiUrl}/api/documents/download/${documentId}`;
  }

  downloadDocument(documentId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/api/documents/download/${documentId}`, { responseType: 'blob' });
  }

  deleteDocument(documentId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/api/documents/${documentId}`);
  }

  updateDocumentNotes(documentId: number, notes: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/api/documents/${documentId}/notes`, { notes });
  }
}

