import { Injectable, NgZone } from '@angular/core';
import { fromEvent, merge, Subscription, timer } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { SESSION } from '../../consts/values/session.const';
import { AuthSessionService } from './auth-session.service';
import { SessionStorageService } from './storage/session-storage.service';
import { StorageKeys } from '../../consts/enums/storage-keys.enum';

@Injectable({ providedIn: 'root' })
export class IdleService {
  private subs?: Subscription;
  private idleTimerSub?: Subscription;

  constructor(
    private zone: NgZone,
    private auth: AuthSessionService,
    private session: SessionStorageService
  ) {}

  /** Arranca la detección de inactividad */
  start(): void {
    this.stop();

    // Registrar actividad inicial
    this.touch();

    // Eventos que consideramos actividad del usuario
    const activity$ = merge(
      fromEvent(window, 'mousemove'),
      fromEvent(window, 'keydown'),
      fromEvent(window, 'touchstart'),
      fromEvent(window, 'scroll')
    ).pipe(debounceTime(300));

    this.zone.runOutsideAngular(() => {
      this.subs = activity$.subscribe(() => this.resetIdleTimer());
    });

    // Arrancar el timer de inactividad
    this.resetIdleTimer();
  }

  /** Detener listeners y timers */
  stop(): void {
    this.subs?.unsubscribe();
    this.idleTimerSub?.unsubscribe();
  }

  /** Reinicia el contador de inactividad */
  private resetIdleTimer(): void {
    this.touch(); // guardar timestamp de última actividad
    this.idleTimerSub?.unsubscribe();

    const ms = SESSION.MAX_INACTIVE_MINUTES * 60_000;
    this.idleTimerSub = timer(ms).subscribe(() => {
      const last = this.getLastActivity();
      if (Date.now() - last >= ms) {
        // Sesión expirada por inactividad
        this.auth.logout();
      } else {
        // Hubo actividad en medio → reiniciar contador
        this.resetIdleTimer();
      }
    });
  }

  /** Marca el tiempo de la última actividad */
  private touch(): void {
    this.session.setProperty(StorageKeys.LAST_ACTIVITY, Date.now());
  }

  /** Recupera el último timestamp de actividad */
  private getLastActivity(): number {
    return this.session.getProperty<number>(StorageKeys.LAST_ACTIVITY) ?? 0;
  }
}
