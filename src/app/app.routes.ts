import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { RegisterComponent } from './pages/register/register';
import { DashboardComponent } from './pages/dashboard/dashboard'; // 1. AGGIUNTO L'IMPORT

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'dashboard', component: DashboardComponent }, // 2. AGGIUNTA LA ROTTA
  { path: '', redirectTo: '/login', pathMatch: 'full' }
];
