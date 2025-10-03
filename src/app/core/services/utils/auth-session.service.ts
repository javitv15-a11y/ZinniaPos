import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

import { Observable, of, throwError, Subject, firstValueFrom } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

import { SessionStorageService } from './storage/session-storage.service';
import { AuthService } from '../bussiness/auth.service';
import { CompanyService } from '../bussiness/company.service';

import { StorageKeys } from '../../consts/enums/storage-keys.enum';
import { ILoginRequest, ILoginResponse } from '../../interfaces/bussiness/login.interface';
import { IUser } from '../../interfaces/bussiness/user.interface';
import { ICompany } from '../../interfaces/bussiness/company.interface';

// Claves de tokens
const ACCESS_TOKEN_KEY = 'zinnia_access_token';
const REFRESH_TOKEN_KEY = 'zinnia_refresh_token';

@Injectable({ providedIn: 'root' })
export class AuthSessionService {

  private readonly USER_KEY = StorageKeys.USER_DATA;
  private readonly COMPANY_KEY = StorageKeys.COMPANY_DATA;

  // Paso 7: clave para recordar la URL de retorno
  private readonly RETURN_URL_KEY = 'return_url';

  private userAuthenticatedSubject = new Subject<ICompany | null>();
  public userAuthenticated$ = this.userAuthenticatedSubject.asObservable();

  // Timers de expiración
  private tokenExpiryTimer: any;   // logout exacto al expirar
  private warnExpiryTimer: any;    // aviso previo (ej. 1 min antes)

  // 🔔 Aviso para la UI: “tu sesión está por expirar”
  private sessionExpiringSubject = new Subject<void>();
  public sessionExpiring$ = this.sessionExpiringSubject.asObservable();

  constructor(
    private router: Router,
    private http: HttpClient,
    private authService: AuthService,
    private _companyService: CompanyService,
    private sessionStorage: SessionStorageService,
  ) {}

  // ----------------------------------------------------------------
  // LOGIN FLOW
  // ----------------------------------------------------------------
  public login(payload: ILoginRequest): Observable<ILoginResponse> {
    return this.authService.login(payload).pipe(
      tap((response: ILoginResponse) => {
        if (!response?.length) {
          throw new Error('Credenciales incorrectas. Verifica tu correo y contraseña.');
        }

        const user = response[0];
        // 1) Guardar usuario inmediatamente
        this.sessionStorage.setProperty(this.USER_KEY, user);

        // 2) Intentar guardar tokens si vinieran en la respuesta
        this.tryExtractAndSaveTokensFromLoginResponse(response);

        // 3) Configurar timers de expiración (aviso + logout)
        this.setupExpiryTimer();

        // 4) Cargar compañía en background
        this._companyService.getCompanyByUser(user.idunico).pipe(
          tap((company) => {
            this.sessionStorage.setProperty(this.COMPANY_KEY, company);
            this.userAuthenticatedSubject.next(company);
          }),
          catchError((err) => {
            console.error('getCompanyByUser failed', err);
            this.userAuthenticatedSubject.next(null);
            return of(null);
          })
        ).subscribe();
      }),
      catchError((err) => {
        const message = err?.error?.message || err?.message || 'Ocurrió un error al iniciar sesión.';
        return throwError(() => new Error(message));
      })
    );
  }

  // ----------------------------------------------------------------
  // LOGOUTS
  // ----------------------------------------------------------------
  public logout(): void {
    this.clearStoredSession();
    this.clearExpiryTimers();
    this.router.navigate(['/login']);
  }

  public hardLogout(): void {
    this.clearStoredSession();
    this.clearExpiryTimers();
  }

  private clearStoredSession(): void {
    this.sessionStorage.removeProperty(this.USER_KEY);
    this.sessionStorage.removeProperty(this.COMPANY_KEY);
    this.sessionStorage.removeProperty(ACCESS_TOKEN_KEY);
    this.sessionStorage.removeProperty(REFRESH_TOKEN_KEY);
    // no borramos RETURN_URL_KEY aquí para respetar la redirección post-login
  }

  private clearExpiryTimers(): void {
    if (this.tokenExpiryTimer) {
      clearTimeout(this.tokenExpiryTimer);
      this.tokenExpiryTimer = null;
    }
    if (this.warnExpiryTimer) {
      clearTimeout(this.warnExpiryTimer);
      this.warnExpiryTimer = null;
    }
  }

  // ----------------------------------------------------------------
  // AUTH STATE
  // ----------------------------------------------------------------
  public isAuthenticated(): boolean {
    const hasUser = !!this.getCurrentUser();
    const hasToken = !!this.getAccessToken();

    if (!hasToken && !hasUser) return false;

    // Si hay token, verificar expiración local con margen
    if (hasToken && this.isAccessTokenExpired(15)) {
      this.hardLogout();
      return false;
    }
    return true;
  }

  public getCurrentUser(): IUser | null {
    return this.sessionStorage.getProperty<IUser>(this.USER_KEY);
  }

  public getUserCompany(): ICompany | null {
    return this.sessionStorage.getProperty<ICompany>(this.COMPANY_KEY);
  }

  // ----------------------------------------------------------------
  // TOKENS
  // ----------------------------------------------------------------
  public setSession(tokens: { accessToken: string; refreshToken?: string }, user?: any): void {
    if (tokens?.accessToken) this.sessionStorage.setProperty(ACCESS_TOKEN_KEY, tokens.accessToken);
    if (tokens?.refreshToken) this.sessionStorage.setProperty(REFRESH_TOKEN_KEY, tokens.refreshToken);
    if (user) this.sessionStorage.setProperty(this.USER_KEY, user);

    // Reprogramar timers al actualizar tokens
    this.setupExpiryTimer();
  }

  public getAccessToken(): string | null {
    return this.sessionStorage.getProperty<string>(ACCESS_TOKEN_KEY) || null;
  }

  public canTryRefresh(): boolean {
    return !!this.sessionStorage.getProperty<string>(REFRESH_TOKEN_KEY);
  }

  public async tryRefreshToken(): Promise<boolean> {
    const refresh = this.sessionStorage.getProperty<string>(REFRESH_TOKEN_KEY);
    if (!refresh) return false;

    try {
      const apiUrl = '/api'; // TODO: cambia a tu baseURL real
      const res = await firstValueFrom(
        this.http.post<{ accessToken?: string; refreshToken?: string; user?: any }>(
          `${apiUrl}/auth/refresh`,
          { refreshToken: refresh }
        )
      );

      if (res?.accessToken) {
        this.setSession({ accessToken: res.accessToken, refreshToken: res.refreshToken }, res.user);
        return true;
      }
      return false;
    } catch {
      this.hardLogout();
      return false;
    }
  }

  // ✅ Paso 5: llamada desde la UI para extender sesión (toast “Seguir conectado”)
  public async extendSession(): Promise<boolean> {
    if (!this.canTryRefresh()) return false;
    const ok = await this.tryRefreshToken();
    if (ok) this.setupExpiryTimer(); // reprograma aviso + logout
    return ok;
  }

  // ----------------------------------------------------------------
  // JWT HELPERS
  // ----------------------------------------------------------------
  public isAccessTokenExpired(offsetSeconds: number = 0): boolean {
    const token = this.getAccessToken();
    if (!token) return true;

    const exp = this.getJwtExp(token);
    if (!exp) return false;
    const now = Math.floor(Date.now() / 1000);
    return exp <= (now + offsetSeconds);
  }

  public msUntilAccessTokenExpiry(): number {
    const token = this.getAccessToken();
    if (!token) return -1;
    const exp = this.getJwtExp(token);
    if (!exp) return -1;
    const nowMs = Date.now();
    const expMs = exp * 1000;
    return Math.max(0, expMs - nowMs);
  }

  // ----------------------------------------------------------------
  // Timers de expiración (aviso + logout exacto)
  // ----------------------------------------------------------------
  private setupExpiryTimer(): void {
    this.clearExpiryTimers();

    const ms = this.msUntilAccessTokenExpiry();
    if (ms > 0) {
      // ⚠️ Aviso 1 minuto antes (cámbialo si quieres otro margen)
      const warnMs = ms - 60_000;
      if (warnMs > 0) {
        this.warnExpiryTimer = setTimeout(() => {
          this.sessionExpiringSubject.next();
        }, warnMs);
      }

      // ⏱️ Logout exacto al expirar
      this.tokenExpiryTimer = setTimeout(() => {
        this.hardLogout();
        this.router.navigateByUrl('/login');
      }, ms);
    }
  }

  // ----------------------------------------------------------------
  // Paso 7: remember returnUrl
  // ----------------------------------------------------------------
  public setReturnUrl(url: string): void {
    if (url && !url.startsWith('/login')) {
      this.sessionStorage.setProperty(this.RETURN_URL_KEY, url);
    }
  }

  public consumeReturnUrl(): string | null {
    const url = this.sessionStorage.getProperty<string>(this.RETURN_URL_KEY) || null;
    if (url) this.sessionStorage.removeProperty(this.RETURN_URL_KEY);
    return url;
  }

  // ----------------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------------
  private tryExtractAndSaveTokensFromLoginResponse(response: ILoginResponse): void {
    const first: any = Array.isArray(response) ? response[0] : response;

    const accessToken =
      first?.accessToken ||
      first?.token ||
      first?.jwt ||
      first?.data?.accessToken;

    const refreshToken =
      first?.refreshToken ||
      first?.data?.refreshToken;

    if (accessToken) this.sessionStorage.setProperty(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) this.sessionStorage.setProperty(REFRESH_TOKEN_KEY, refreshToken);

    // Si guardamos tokens aquí, reprogramamos timers
    this.setupExpiryTimer();
  }

  private getJwtExp(token: string): number | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return typeof payload?.exp === 'number' ? payload.exp : null;
    } catch {
      return null;
    }
  }
}
