import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Toast {
  id: number;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private counter = 0;
  private toastsSubject = new BehaviorSubject<Toast[]>([]);
  toasts$ = this.toastsSubject.asObservable();

  show(title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success', duration: number = 3500): void {
    const id = ++this.counter;
    const toast: Toast = { id, title, message, type, duration };
    this.toastsSubject.next([...this.toastsSubject.value, toast]);

    setTimeout(() => this.dismiss(id), duration);
  }

  success(title: string, message: string): void {
    this.show(title, message, 'success');
  }

  error(title: string, message: string): void {
    this.show(title, message, 'error', 4500);
  }

  warning(title: string, message: string): void {
    this.show(title, message, 'warning', 4000);
  }

  info(title: string, message: string): void {
    this.show(title, message, 'info', 3500);
  }

  dismiss(id: number): void {
    this.toastsSubject.next(this.toastsSubject.value.filter(t => t.id !== id));
  }
}

