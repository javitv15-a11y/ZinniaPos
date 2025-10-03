import { Injectable } from '@angular/core';
import {
  HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpErrorResponse
} from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError, from } from 'rxjs';
import { catchError, switchMap, finalize } from 'rxjs/operators';
import { AuthSessionService } from '../services/utils/auth-session.service';
import { SessionTimeoutService } from '../services/utils/session-timeout.service';

const shouldCountAsActivity = (url: string) => !(
  url.includes('/auth/login') ||
  url.includes('/auth/refresh')
);

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(
    private auth: AuthSessionService,
    private router: Router,
    private timeout: SessionTimeoutService,
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // 🔒 PRE-CHECK: Si hay token pero está vencido (con margen de 15s) => logout inmediato + returnUrl
    if (this.auth.getAccessToken() && this.auth.isAccessTokenExpired(15)) {
      const current = this.router.url;
      this.auth.setReturnUrl(current);
      this.auth.hardLogout();
      this.router.navigate(['/login'], { queryParams: { returnUrl: current } });
      return throwError(() => new Error('Access token expired (local check)'));
    }

    // 👉 Adjuntar token si existe
    const token = this.auth.getAccessToken();
    const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        const expired =
          error.status === 401 || error.status === 419 || error.status === 440 ||
          (error.status === 403 && (error.error?.code === 'TOKEN_EXPIRED'));

        // 👉 Reintento con refresh (si aplica y no hemos reintentado esta request)
        if (error.status === 401 && this.auth.canTryRefresh() && !req.headers.has('X-Refresh-Retried')) {
          return from(this.auth.tryRefreshToken()).pipe(
            switchMap(ok => {
              if (!ok) {
                const current = this.router.url;
                this.auth.setReturnUrl(current);
                this.auth.hardLogout();
                this.router.navigate(['/login'], { queryParams: { returnUrl: current } });
                return throwError(() => error);
              }
              const retryReq = req.clone({
                setHeaders: {
                  Authorization: `Bearer ${this.auth.getAccessToken()}`,
                  'X-Refresh-Retried': '1'
                }
              });
              return next.handle(retryReq);
            }),
            catchError(() => {
              const current = this.router.url;
              this.auth.setReturnUrl(current);
              this.auth.hardLogout();
              this.router.navigate(['/login'], { queryParams: { returnUrl: current } });
              return throwError(() => error);
            })
          );
        }

        if (expired) {
          const current = this.router.url;
          this.auth.setReturnUrl(current);
          this.auth.hardLogout();
          this.router.navigate(['/login'], { queryParams: { returnUrl: current } });
        }

        return throwError(() => error);
      }),
      finalize(() => {
        // ⭐️ Reinicia el timeout en cada request (excepto login/refresh)
        if (shouldCountAsActivity(req.url)) {
          this.timeout.resetTimer();
        }
      })
    );
  }
}
