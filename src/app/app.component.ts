import { Component, OnDestroy, OnInit } from '@angular/core';
import { TranslationService } from './core/services/translation.service';
import { IonApp, IonContent, IonRouterOutlet } from '@ionic/angular/standalone';
import { StatusBar } from '@awesome-cordova-plugins/status-bar/ngx';
import { CommonModule } from '@angular/common';
import { LaunchNavigator } from '@awesome-cordova-plugins/launch-navigator/ngx';
import { MenuComponent } from './shared/components/menu/menu.component';
import { addIcons } from 'ionicons';
import { arrowBack } from 'ionicons/icons';
import { MenuFooterComponent } from './shared/components/menu-footer/menu-footer.component';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';

import { Subject } from 'rxjs';
import { filter, map, distinctUntilChanged, takeUntil } from 'rxjs/operators';

import { SessionTimeoutService } from './core/services/utils/session-timeout.service';
import { AuthSessionService } from './core/services/utils/auth-session.service';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [
    IonApp, 
    IonRouterOutlet,
    CommonModule,
    MenuComponent,
    IonContent,
    MenuFooterComponent,
  ],
  providers: [ StatusBar, LaunchNavigator ]
})
export class AppComponent implements OnInit, OnDestroy {

  isMenuOpen: boolean = false;
  showTab: boolean = false;

  private destroy$ = new Subject<void>();
  private publicRoutes = ['/login', '/register', '/forgot-password'];

  constructor(
    private _router: Router,
    private _activatedRoute: ActivatedRoute,
    private translationService: TranslationService,
    private timeout: SessionTimeoutService,
    private auth: AuthSessionService,
    private toastCtrl: ToastController
  ) {
    addIcons({ arrowBack });
  }

  ngOnInit(): void {
    // Timeout de inactividad
    this.timeout.start();

    this._router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(() => this._router.url),
      map(url => this.isPublicUrl(url)),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(isPublic => {
      if (isPublic) this.timeout.stop();
      else this.timeout.start();
    });

    this.updateShowTabFromRoute();

    // 👇 Suscripción al aviso de expiración de sesión
    this.auth.sessionExpiring$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.showSessionExpiringToast());
  }

  private async showSessionExpiringToast() {
    const toast = await this.toastCtrl.create({
      message: '⚠️ Tu sesión expirará en 1 minuto',
      position: 'bottom',
      duration: 60000,
      buttons: [
        {
          text: 'Seguir conectado',
          handler: async () => {
            const ok = await this.auth.extendSession();
            if (ok) {
              console.log('Sesión extendida ✔️');
            } else {
              console.warn('No se pudo extender la sesión');
            }
          }
        },
        {
          text: 'Cerrar sesión',
          role: 'cancel',
          handler: () => this.auth.logout()
        }
      ]
    });
    await toast.present();
  }

  menuWillOpen() { this.isMenuOpen = true; }
  menuDidClose() { this.isMenuOpen = false; }

  private updateShowTabFromRoute(): void { 
    this._router.events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntil(this.destroy$))
      .subscribe(() => {
        let route = this._activatedRoute;
        while (route.firstChild) { route = route.firstChild; }
        this.showTab = route.snapshot.data['showTab'] ?? false;
      });
  }

  private isPublicUrl(url: string): boolean {
    return this.publicRoutes.some(prefix => url.startsWith(prefix));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.timeout.clearAll();
  }
}
