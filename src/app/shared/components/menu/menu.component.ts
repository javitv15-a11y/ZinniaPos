// menu.component.ts
import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController, ToastController, MenuController } from '@ionic/angular';
import { Router } from '@angular/router';
import { Browser } from '@capacitor/browser';

import { addIcons } from 'ionicons';
import {
  chevronForward,
  personOutline,
  cashOutline,
  lockClosedOutline,
  shieldCheckmarkOutline,
  shieldOutline,
  trashOutline,
  logOutOutline,
  arrowBack
} from 'ionicons/icons';

import { menuItems } from './menu-consts';

// Servicios propios de tu app
import { LocalStorageService } from 'src/app/core/services/utils/storage/local-storage.service';
import { AuthSessionService } from 'src/app/core/services/utils/auth-session.service';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule],
})
export class MenuComponent implements OnInit, OnChanges {
  @Input() isOpen!: boolean;
  @Input() contentId!: string;

  public user: any;
  public appVersion = '1.0.0';
  public menuItemsItems = menuItems;

  constructor(
    private router: Router,
    private alertController: AlertController,
    private toastController: ToastController,
    private menuCtrl: MenuController,
    private localStore: LocalStorageService,
    private _authSession: AuthSessionService
  ) {
    addIcons({
      chevronForward,
      personOutline,
      cashOutline,
      lockClosedOutline,
      shieldCheckmarkOutline,
      shieldOutline,
      trashOutline,
      logOutOutline,
      arrowBack
    });
  }

  ngOnInit(): void {
    this.getUserData();
  }

  ngOnChanges(_: SimpleChanges): void {
    this.getUserData();
  }

  ionViewDidEnter(): void {
    this.getUserData();
  }

  public async gotTo(item: any): Promise<void> {
    if (item?.route) {
      await this.router.navigate([item.route]);
      await this.menuCtrl.close('first-menu');
      return;
    }

    if (item?.externalRoute) {
      await Browser.open({ url: item.externalRoute });
      await this.menuCtrl.close('first-menu');
      return;
    }

    if (item?.deleteAccount) {
      const toast = await this.toastController.create({
        message: 'Funcionalidad de eliminar cuenta no implementada.',
        duration: 2000,
        position: 'bottom'
      });
      await toast.present();
      return;
    }

    if (item?.logout) {
      await this.presentLogoutConfirm();
      return;
    }
  }

  private getUserData(): void {
    const userData = this._authSession.getCurrentUser?.() ?? null;
    if (userData) {
      this.user = userData;
    }
  }

  // === Confirmación de cierre de sesión ===
  private async presentLogoutConfirm(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Cerrar sesión',
      message: '¿Estás seguro que quieres cerrar sesión?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Sí, cerrar',
          handler: async () => { await this.handleLogout(); }
        }
      ]
    });
    await alert.present();
  }

  // === Helper: ejecutar seguro sin romper flujo ===
  private async safeRun<T>(fn: () => Promise<T> | T, label: string): Promise<{ ok: boolean; error?: any }> {
    try {
      await fn();
      return { ok: true };
    } catch (err) {
      console.error(`[logout] fallo en ${label}:`, err);
      return { ok: false, error: err };
    }
  }

  // === Lógica de cierre de sesión ===
  private async handleLogout(): Promise<void> {
    // Paso A: intenta cerrar sesión con tu servicio
    const authStep = await this.safeRun(async () => {
      if (this._authSession?.logout) {
        await this._authSession.logout();
      }
    }, 'authSession.logout');

    // Paso B: limpia storage propio
    const localStoreStep = await this.safeRun(async () => {
      await this.localStore?.clear?.();
    }, 'localStore.clear');

    // Paso C: cookies y storages del navegador
    await this.safeRun(() => this.clearAllCookies(), 'clearAllCookies');
    await this.safeRun(async () => { localStorage?.clear?.(); }, 'localStorage.clear');
    await this.safeRun(async () => { sessionStorage?.clear?.(); }, 'sessionStorage.clear');

    // Paso D: cierra el menú
    await this.safeRun(() => this.menuCtrl.close('first-menu'), 'menuCtrl.close');

    // Éxito si auth no falló (o no existe) y storage se limpió
    const cleanupOk = localStoreStep.ok;
    const success = (authStep.ok || this._authSession?.logout == null) && cleanupOk;

    if (success) {
      await this.safeRun(async () => {
        const t = await this.toastController.create({
          message: 'Sesión cerrada correctamente',
          duration: 1800,
          position: 'bottom',
          icon: 'log-out-outline'
        });
        await t.present();
      }, 'toast success');

      await this.safeRun(() => this.router.navigate(['/auth/login']), 'router.navigate');
    } else {
      await this.safeRun(async () => {
        const t = await this.toastController.create({
          message: 'No se pudo cerrar sesión. Intenta de nuevo.',
          duration: 2000,
          position: 'bottom'
        });
        await t.present();
      }, 'toast error');
    }
  }

  // === Limpiar cookies ===
  private clearAllCookies(): void {
    if (typeof document === 'undefined' || !document.cookie) return;

    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
      document.cookie = `${name.trim()}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    }
  }
}
