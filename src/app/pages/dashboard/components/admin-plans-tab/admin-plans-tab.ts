import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
@Component({ selector: 'app-admin-plans-tab', standalone: true, imports: [CommonModule], templateUrl: './admin-plans-tab.html', styleUrls: ['./admin-plans-tab.css'] })
export class AdminPlansTabComponent {
  @Input() allPlans: any[] = [];
  @Input() allSubscriptions: any[] = [];
  getActiveSubsForPlan(planName: string): number { return this.allSubscriptions.filter(s => s.active && s.planName === planName).length; }
  getDurationLabel(duration: string): string { switch (duration) { case 'SEMESTRALE': return '6 mesi'; case 'ANNUALE': return '12 mesi'; default: return duration; } }
}
