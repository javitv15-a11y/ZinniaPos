import { enableProdMode, LOCALE_ID } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter } from '@angular/router';
import { IonicRouteStrategy } from '@ionic/angular';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { InterceptorService } from './app/core/services/interceptors/interceptor.service';
import { AuthInterceptor } from './app/core/interceptors/auth.interceptor'; // 👈 NUEVO

import { ModalController, LoadingController, ToastController } from '@ionic/angular';
import { LocationAccuracy } from '@awesome-cordova-plugins/location-accuracy/ngx';
import { registerLocaleData } from '@angular/common';
import localeEsCO from '@angular/common/locales/es-CO';

if (environment.production) {
  enableProdMode();
}

registerLocaleData(localeEsCO);

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular({ _forceStatusbarPadding: true }),
    provideRouter(routes),

    // DI para interceptores
    provideHttpClient(withInterceptorsFromDi()),

    // 👇 Orden recomendado: Auth primero (inyecta token) y luego el tuyo
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: InterceptorService, multi: true },

    { provide: LOCALE_ID, useValue: 'es-CO' },

    // Otros providers
    ModalController,
    LoadingController,
    ToastController,
    LocationAccuracy,
  ],
});
