// src/app/core/guards/auth/unauthenticated.guard.ts
import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { AuthSessionService } from '../../services/utils/auth-session.service';

@Injectable({ providedIn: 'root' })
export class UnauthenticatedGuard  {
  constructor(
    private auth: AuthSessionService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    const isLogged = this.auth.isAuthenticated();

    if (isLogged) {
      const qpReturn = route.queryParamMap.get('returnUrl');
      return this.router.parseUrl(qpReturn || '/dashboard');
    }

    return true;
  }
}
