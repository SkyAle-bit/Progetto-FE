import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-home-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-home-tab.html',
  styleUrls: ['./admin-home-tab.css']
})
export class AdminHomeTabComponent {
  @Input() currentUser: any;
  @Input() allUsers: any[] = [];
  @Input() allPlans: any[] = [];
  @Input() allSubscriptions: any[] = [];
  @Input() isModerator: boolean = false;
  @Output() setTabEvent = new EventEmitter<string>();

  get totalUsers(): number { return this.allUsers.length; }
  get totalClients(): number { return this.allUsers.filter(u => u.role === 'CLIENT').length; }
  get totalProfessionals(): number { return this.allUsers.filter(u => u.role === 'PERSONAL_TRAINER' || u.role === 'NUTRITIONIST' || u.role === 'INSURANCE_MANAGER').length; }
  get activeSubscriptions(): number { return this.allSubscriptions.filter(s => s.active).length; }
  get estimatedRevenue(): number {
    return this.allSubscriptions.filter(s => s.active).reduce((sum, s) => sum + (s.monthlyPrice || 0), 0);
  }

  getRoleLabel(role: string): string {
    switch (role) {
      case 'CLIENT': return 'Cliente';
      case 'PERSONAL_TRAINER': return 'Personal Trainer';
      case 'NUTRITIONIST': return 'Nutrizionista';
      case 'ADMIN': return 'Admin';
      case 'INSURANCE_MANAGER': return 'Assicurazione';
      default: return role;
    }
  }

  getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'CLIENT': return 'bg-blue-50 text-blue-600';
      case 'PERSONAL_TRAINER': return 'bg-emerald-50 text-emerald-600';
      case 'NUTRITIONIST': return 'bg-amber-50 text-amber-700';
      case 'ADMIN': return 'bg-purple-50 text-purple-600';
      case 'INSURANCE_MANAGER': return 'bg-indigo-50 text-indigo-600';
      default: return 'bg-gray-50 text-gray-600';
    }
  }

  getInitials(): string {
    return ((this.currentUser?.firstName ?? '').charAt(0) + (this.currentUser?.lastName ?? '').charAt(0)).toUpperCase();
  }
}

