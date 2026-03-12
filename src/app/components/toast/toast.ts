import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../services/toast.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed bottom-4 right-4 left-4 sm:left-auto z-[5000] flex flex-col-reverse gap-2 sm:max-w-[380px] sm:w-[380px] pointer-events-none" style="bottom: max(1rem, env(safe-area-inset-bottom))">
      <div *ngFor="let toast of toasts; trackBy: trackById"
        class="toast-item pointer-events-auto flex items-start gap-2.5 sm:gap-3 px-3.5 sm:px-4 py-3 sm:py-3.5 rounded-xl shadow-[0_8px_32px_rgba(26,39,68,0.18)] border backdrop-blur-sm relative overflow-hidden cursor-pointer"
        [ngClass]="getClasses(toast.type)"
        (click)="dismiss(toast.id)">
        <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          [ngClass]="getIconBg(toast.type)">
          <span class="text-[0.9rem] sm:text-[1rem]">{{ getIcon(toast.type) }}</span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-[0.78rem] sm:text-[0.82rem] font-bold leading-tight"
            [ngClass]="getTitleCls(toast.type)">{{ toast.title }}</div>
          <div class="text-[0.68rem] sm:text-[0.72rem] mt-0.5 leading-snug break-words"
            [ngClass]="getMsgCls(toast.type)">{{ toast.message }}</div>
        </div>
        <button class="w-5 h-5 flex items-center justify-center rounded opacity-40 hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5"
          (click)="dismiss(toast.id); $event.stopPropagation()">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
        <div class="absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden">
          <div class="h-full toast-bar"
            [ngClass]="getBarCls(toast.type)"
            [style.animation-duration.ms]="toast.duration">
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .toast-item {
      animation: toastIn .3s cubic-bezier(.16,1,.3,1);
    }
    @keyframes toastIn {
      from { opacity: 0; transform: translateX(40px) scale(.96); }
      to { opacity: 1; transform: translateX(0) scale(1); }
    }
    .toast-bar {
      animation: toastBar linear forwards;
    }
    @keyframes toastBar {
      from { width: 100%; }
      to { width: 0%; }
    }
  `]
})
export class ToastComponent implements OnInit, OnDestroy {
  private svc = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private sub!: Subscription;
  toasts: Toast[] = [];

  ngOnInit() {
    this.sub = this.svc.toasts$.subscribe(t => {
      this.toasts = t;
      this.cdr.detectChanges();
    });
  }
  ngOnDestroy() { this.sub?.unsubscribe(); }
  dismiss(id: number) { this.svc.dismiss(id); }
  trackById(_: number, t: Toast) { return t.id; }

  getClasses(type: string) {
    return type === 'success' ? 'bg-white border-emerald-200'
      : type === 'error' ? 'bg-white border-red-200'
      : type === 'warning' ? 'bg-white border-amber-200'
      : 'bg-white border-[#ccd8ed]';
  }
  getIconBg(type: string) {
    return type === 'success' ? 'bg-emerald-50'
      : type === 'error' ? 'bg-red-50'
      : type === 'warning' ? 'bg-amber-50'
      : 'bg-[#f2f6fc]';
  }
  getIcon(type: string) {
    return type === 'success' ? '✓'
      : type === 'error' ? '✕'
      : type === 'warning' ? '⚠'
      : 'ℹ';
  }
  getTitleCls(type: string) {
    return type === 'success' ? 'text-emerald-800'
      : type === 'error' ? 'text-red-800'
      : type === 'warning' ? 'text-amber-800'
      : 'text-[#1a2744]';
  }
  getMsgCls(type: string) {
    return type === 'success' ? 'text-emerald-600/80'
      : type === 'error' ? 'text-red-500/80'
      : type === 'warning' ? 'text-amber-600/80'
      : 'text-[#8fa3c8]';
  }
  getBarCls(type: string) {
    return type === 'success' ? 'bg-emerald-400'
      : type === 'error' ? 'bg-red-400'
      : type === 'warning' ? 'bg-amber-400'
      : 'bg-[#c9a96e]';
  }
}

