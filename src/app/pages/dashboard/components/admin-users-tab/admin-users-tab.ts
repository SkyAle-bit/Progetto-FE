import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin-users-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-users-tab.html',
  styleUrls: ['./admin-users-tab.css']
})
export class AdminUsersTabComponent {
  @Input() allUsers: any[] = [];

  searchQuery: string = '';
  roleFilter: string = 'ALL';

  get filteredUsers(): any[] {
    let users = this.allUsers;
    if (this.roleFilter !== 'ALL') {
      users = users.filter(u => u.role === this.roleFilter);
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      users = users.filter(u =>
        (u.firstName + ' ' + u.lastName).toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
      );
    }
    return users;
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

  getRoleEmoji(role: string): string {
    switch (role) {
      case 'CLIENT': return '🧑';
      case 'PERSONAL_TRAINER': return '💪';
      case 'NUTRITIONIST': return '🥗';
      case 'ADMIN': return '🛡️';
      case 'INSURANCE_MANAGER': return '📋';
      default: return '👤';
    }
  }
}

