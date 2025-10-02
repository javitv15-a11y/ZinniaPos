import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

import { Observable, of, throwError, Subject } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

import { SessionStorageService } from './storage/session-storage.service';
import { AuthService } from '../bussiness/auth.service';
import { CompanyService } from '../bussiness/company.service';

import { StorageKeys } from '../../consts/enums/storage-keys.enum';
import { ILoginRequest, ILoginResponse } from '../../interfaces/bussiness/login.interface';
import { IUser } from '../../interfaces/bussiness/user.interface';
import { ICompany } from '../../interfaces/bussiness/company.interface';

@Injectable({ providedIn: 'root' })
export class AuthSessionService {

  private readonly USER_KEY = StorageKeys.USER_DATA;
  private readonly COMPANY_KEY = StorageKeys.COMPANY_DATA;

  private userAuthenticatedSubject = new Subject<ICompany | null>();
  public userAuthenticated$ = this.userAuthenticatedSubject.asObservable();

  constructor(
    private router: Router,
    private authService: AuthService,
    private _companyService: CompanyService,
    private sessionStorage: SessionStorageService,
  ) {}

  /**
   * ✅ Guarda el usuario en sesión inmediatamente para que AuthGuard permita el acceso.
   * ✅ Carga la compañía en background (no bloquea el login). Si falla, no rompe el flujo.
   */
  public login(payload: ILoginRequest): Observable<ILoginResponse> {
    return this.authService.login(payload).pipe(
      tap((response: ILoginResponse) => {
        if (!response?.length) {
          throw new Error('Credenciales incorrectas. Verifica tu correo y contraseña.');
        }

        // 1) Guardar usuario YA (clave para que el guard te deje pasar)
        const user = response[0];
        this.sessionStorage.setProperty(this.USER_KEY, user);

        // 2) Cargar compañía en segundo plano (fire-and-forget)
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

  public logout(): void {
    this.sessionStorage.clearSession();
    this.router.navigate(['/login']);
  }

  public isAuthenticated(): boolean {
    return !!this.sessionStorage.getProperty<IUser>(this.USER_KEY);
  }

  public getCurrentUser(): IUser | null {
    return this.sessionStorage.getProperty<IUser>(this.USER_KEY);
  }

  public getUserCompany(): ICompany | null {
    return this.sessionStorage.getProperty<ICompany>(this.COMPANY_KEY);
  }
}
