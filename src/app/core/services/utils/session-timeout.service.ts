import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AuthSessionService } from './auth-session.service';

@Injectable({ providedIn: 'root' })
export class SessionTimeoutService {

  private timeoutMs = 30 * 60 * 1000; // ⏱️ 30 minutos por defecto
  private timer: any;

  constructor(
    private auth: AuthSessionService,
    private router: Router
  ) {}

  /**
   * Inicia el timer de inactividad.
   * @param ms Tiempo en milisegundos (opcional, default 30min).
   */
  public start(ms?: number): void {
    this.timeoutMs = ms ?? this.timeoutMs;
    this.resetTimer();
  }

  /** Reinicia el contador (llamar en cada request o actividad) */
  public resetTimer(): void {
    this.clearTimer();

    this.timer = setTimeout(() => {
      this.handleTimeout();
    }, this.timeoutMs);
  }

  /** Detiene el timer */
  public stop(): void {
    this.clearTimer();
  }

  /** Limpia todo (usado en destroy o logout manual) */
  public clearAll(): void {
    this.clearTimer();
  }

  /** Lógica cuando expira la sesión por inactividad */
  private handleTimeout(): void {
    console.warn('⚠️ Sesión expirada por inactividad');
    this.auth.hardLogout();
    this.router.navigateByUrl('/login');
  }

  // ----------------------------------------------------------------
  // Helpers internos
  // ----------------------------------------------------------------
  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
