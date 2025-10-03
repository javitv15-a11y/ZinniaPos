import { Routes } from '@angular/router';
import { UnauthenticatedGuard } from './core/guards/auth/unauthenticated.guard';
import { AuthCanMatchGuard } from './core/guards/auth/auth-can-match.guard';  // 👈 importa el canMatch
import { dashboardRoutes } from './pages/dashboard/dashboard.routing';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login.component').then(m => m.LoginComponent),
    canActivate: [UnauthenticatedGuard],
    data: { showTab: false }
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.component').then(m => m.RegisterComponent),
    canActivate: [UnauthenticatedGuard],
  },
  {
    path: 'dashboard',
    canMatch: [AuthCanMatchGuard],           
    children: dashboardRoutes,
  },
  {
    path:'validate-code',
    loadComponent: () => import('./pages/validation-code/validation-code.component')
      .then(m => m.ValidationCodeComponent),
  },
  {
    path:'onboarding',
    loadComponent: () => import('./pages/onboarding/onbording.component')
      .then(m => m.OnbordingComponent),
  }
];
