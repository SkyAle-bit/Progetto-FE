import {
  Directive, ElementRef, EventEmitter, NgZone, OnDestroy, OnInit, Output, Renderer2
} from '@angular/core';

@Directive({
  selector: '[appPullToRefresh]',
  standalone: true
})
export class PullToRefreshDirective implements OnInit, OnDestroy {
  @Output() refresh = new EventEmitter<void>();

  private startY = 0;
  private currentY = 0;
  private pulling = false;
  private threshold = 70;    // px da tirare per attivare il refresh
  private maxPull = 110;     // px massimi di pull
  private indicator: HTMLElement | null = null;
  private spinner: HTMLElement | null = null;
  private arrow: HTMLElement | null = null;
  private text: HTMLElement | null = null;

  private removeTouchStart: (() => void) | null = null;
  private removeTouchMove: (() => void) | null = null;
  private removeTouchEnd: (() => void) | null = null;

  constructor(
    private el: ElementRef<HTMLElement>,
    private renderer: Renderer2,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    this.createIndicator();
    this.zone.runOutsideAngular(() => this.bindEvents());
  }

  ngOnDestroy(): void {
    this.removeTouchStart?.();
    this.removeTouchMove?.();
    this.removeTouchEnd?.();
    this.indicator?.remove();
  }

  private createIndicator(): void {
    // Container indicatore
    this.indicator = this.renderer.createElement('div');
    this.renderer.setStyle(this.indicator, 'position', 'absolute');
    this.renderer.setStyle(this.indicator, 'top', '0');
    this.renderer.setStyle(this.indicator, 'left', '0');
    this.renderer.setStyle(this.indicator, 'right', '0');
    this.renderer.setStyle(this.indicator, 'display', 'flex');
    this.renderer.setStyle(this.indicator, 'align-items', 'center');
    this.renderer.setStyle(this.indicator, 'justify-content', 'center');
    this.renderer.setStyle(this.indicator, 'gap', '8px');
    this.renderer.setStyle(this.indicator, 'height', '0px');
    this.renderer.setStyle(this.indicator, 'overflow', 'hidden');
    this.renderer.setStyle(this.indicator, 'z-index', '50');
    this.renderer.setStyle(this.indicator, 'pointer-events', 'none');
    this.renderer.setStyle(this.indicator, 'transition', 'none');

    // Spinner (nascosto fino al rilascio)
    this.spinner = this.renderer.createElement('div');
    this.renderer.setStyle(this.spinner, 'width', '20px');
    this.renderer.setStyle(this.spinner, 'height', '20px');
    this.renderer.setStyle(this.spinner, 'border', '2.5px solid #ccd8ed');
    this.renderer.setStyle(this.spinner, 'borderTop', '2.5px solid #c9a96e');
    this.renderer.setStyle(this.spinner, 'borderRadius', '50%');
    this.renderer.setStyle(this.spinner, 'display', 'none');

    // Freccia
    this.arrow = this.renderer.createElement('div');
    this.renderer.setProperty(this.arrow, 'innerHTML', '↓');
    this.renderer.setStyle(this.arrow, 'fontSize', '16px');
    this.renderer.setStyle(this.arrow, 'color', '#8fa3c8');
    this.renderer.setStyle(this.arrow, 'transition', 'transform 0.2s ease');
    this.renderer.setStyle(this.arrow, 'fontWeight', '700');

    // Testo
    this.text = this.renderer.createElement('span');
    this.renderer.setProperty(this.text, 'textContent', 'Tira per aggiornare');
    this.renderer.setStyle(this.text, 'fontSize', '0.72rem');
    this.renderer.setStyle(this.text, 'color', '#8fa3c8');
    this.renderer.setStyle(this.text, 'fontWeight', '600');

    this.renderer.appendChild(this.indicator, this.spinner);
    this.renderer.appendChild(this.indicator, this.arrow);
    this.renderer.appendChild(this.indicator, this.text);

    // Assicura position relative sul parent
    const host = this.el.nativeElement;
    const pos = getComputedStyle(host).position;
    if (pos === 'static' || !pos) {
      this.renderer.setStyle(host, 'position', 'relative');
    }
    this.renderer.insertBefore(host, this.indicator, host.firstChild);
  }

  private bindEvents(): void {
    const el = this.el.nativeElement;

    this.removeTouchStart = this.renderer.listen(el, 'touchstart', (e: TouchEvent) => {
      // Solo se scrollato in cima
      if (el.scrollTop > 5) return;
      this.startY = e.touches[0].clientY;
      this.pulling = true;
      if (this.indicator) {
        this.renderer.setStyle(this.indicator, 'transition', 'none');
      }
    });

    this.removeTouchMove = this.renderer.listen(el, 'touchmove', (e: TouchEvent) => {
      if (!this.pulling) return;
      this.currentY = e.touches[0].clientY;
      const diff = this.currentY - this.startY;

      if (diff < 0) { this.resetVisual(); return; }
      if (el.scrollTop > 0) { this.resetVisual(); return; }

      // Resistenza logaritmica per sensazione naturale
      const pull = Math.min(diff * 0.45, this.maxPull);

      if (pull > 10) {
        // Previene scroll nativo del browser quando stiamo tirando
        e.preventDefault();
      }

      if (this.indicator) {
        this.renderer.setStyle(this.indicator, 'height', pull + 'px');
      }

      if (this.arrow) {
        const rotate = pull >= this.threshold ? 180 : 0;
        this.renderer.setStyle(this.arrow, 'transform', `rotate(${rotate}deg)`);
        this.renderer.setStyle(this.arrow, 'color', pull >= this.threshold ? '#c9a96e' : '#8fa3c8');
      }
      if (this.text) {
        this.renderer.setProperty(this.text, 'textContent',
          pull >= this.threshold ? 'Rilascia per aggiornare' : 'Tira per aggiornare');
        this.renderer.setStyle(this.text, 'color', pull >= this.threshold ? '#c9a96e' : '#8fa3c8');
      }
    });

    this.removeTouchEnd = this.renderer.listen(el, 'touchend', () => {
      if (!this.pulling) return;
      this.pulling = false;
      const diff = (this.currentY - this.startY) * 0.45;

      if (diff >= this.threshold) {
        // Attivato! Mostra spinner
        this.showRefreshing();
        this.zone.run(() => this.refresh.emit());

        // Auto-chiudi dopo 1.2s (il componente padre farà il refresh nel frattempo)
        setTimeout(() => this.hideIndicator(), 1200);
      } else {
        this.hideIndicator();
      }

      this.startY = 0;
      this.currentY = 0;
    });
  }

  private showRefreshing(): void {
    if (this.spinner) {
      this.renderer.setStyle(this.spinner, 'display', 'block');
      this.renderer.setStyle(this.spinner, 'animation', 'ptr-spin 0.7s linear infinite');
    }
    if (this.arrow) {
      this.renderer.setStyle(this.arrow, 'display', 'none');
    }
    if (this.text) {
      this.renderer.setProperty(this.text, 'textContent', 'Aggiornamento...');
      this.renderer.setStyle(this.text, 'color', '#c9a96e');
    }
    if (this.indicator) {
      this.renderer.setStyle(this.indicator, 'height', '44px');
      this.renderer.setStyle(this.indicator, 'transition', 'height 0.25s ease');
    }

    // Inietta keyframe se non esiste
    if (!document.getElementById('ptr-spin-style')) {
      const style = document.createElement('style');
      style.id = 'ptr-spin-style';
      style.textContent = '@keyframes ptr-spin { to { transform: rotate(360deg); } }';
      document.head.appendChild(style);
    }
  }

  private hideIndicator(): void {
    if (this.indicator) {
      this.renderer.setStyle(this.indicator, 'transition', 'height 0.25s ease');
      this.renderer.setStyle(this.indicator, 'height', '0px');
    }
    setTimeout(() => this.resetVisual(), 300);
  }

  private resetVisual(): void {
    if (this.spinner) {
      this.renderer.setStyle(this.spinner, 'display', 'none');
      this.renderer.setStyle(this.spinner, 'animation', 'none');
    }
    if (this.arrow) {
      this.renderer.setStyle(this.arrow, 'display', 'block');
      this.renderer.setStyle(this.arrow, 'transform', 'rotate(0deg)');
      this.renderer.setStyle(this.arrow, 'color', '#8fa3c8');
    }
    if (this.text) {
      this.renderer.setProperty(this.text, 'textContent', 'Tira per aggiornare');
      this.renderer.setStyle(this.text, 'color', '#8fa3c8');
    }
  }
}


