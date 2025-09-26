// src/app/pages/dashboard/suppliers/components/supplier-detail/supplier-detail.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { IonicModule, NavController, ToastController, AlertController } from '@ionic/angular';
import { HttpClientModule } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms'; // 👈 IMPORTANTE

import { firstValueFrom } from 'rxjs';
import { SupplierService } from 'src/app/core/services/bussiness/supplier.service';
import { UpdateSupplierPayload } from 'src/app/core/interfaces/bussiness/supplier.interface';

type UISupplier = {
  id: string;
  name: string;
  correo?: string;
  telefono?: string;
  address?: string;
  fechaRegistroDate?: Date;
};

@Component({
  selector: 'app-supplier-detail',
  standalone: true,
  imports: [CommonModule, IonicModule, HttpClientModule, FormsModule], // 👈 AÑADIDO
  templateUrl: './supplier-detail.component.html',
  styleUrls: ['./supplier-detail.component.scss'],
})
export class SupplierDetailComponent implements OnInit {
  loading = false;
  error?: string;

  supplier?: UISupplier | null;
  private id = '';

  // Modal de edición (ngModel en ion-input)
  editOpen = false;
  edit: { name: string; email: string; phone: string; address: string } = {
    name: '',
    email: '',
    phone: '',
    address: '',
  };

  constructor(
    private route: ActivatedRoute,
    private nav: NavController,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private supplierSrv: SupplierService
  ) {}

  ngOnInit(): void {
    this.id = String(this.route.snapshot.paramMap.get('id') || '');
    this.load();
  }

  async load(ev?: CustomEvent) {
    this.loading = true;
    this.error = undefined;
    try {
      let raw = await firstValueFrom(this.supplierSrv.getSupplierById(this.id));
      if (!raw) {
        const list = await firstValueFrom(this.supplierSrv.getAllSuppliers());
        raw = list.find((x: any) => String(x.id) === this.id) ?? null;
      }
      if (!raw) {
        this.supplier = null;
        throw new Error('Proveedor no encontrado');
      }
      this.supplier = this.toUISupplier(raw as any);
    } catch (e: any) {
      this.error = e?.message || 'No se pudo cargar el proveedor';
    } finally {
      this.loading = false;
      (ev?.target as HTMLIonRefresherElement)?.complete?.();
    }
  }

  goBack() {
    if (history.length > 1) this.nav.back();
    else this.nav.navigateBack(['/dashboard', 'suppliers']);
  }

  openEdit() {
    if (!this.supplier) return;
    this.edit = {
      name: this.supplier.name || '',
      email: this.supplier.correo || '',
      phone: this.supplier.telefono || '',
      address: this.supplier.address || '',
    };
    this.editOpen = true;
  }

  closeEdit() {
    this.editOpen = false;
  }

  async saveEdit() {
    if (!this.supplier) return;
    const id = this.supplier.id.trim();
    const payload: UpdateSupplierPayload = {
      id,
      name: this.edit.name?.trim(),
      email: this.edit.email?.trim(),
      phone: this.edit.phone?.trim(),
      address: this.edit.address?.trim(),
    };

    try {
      await firstValueFrom(this.supplierSrv.updateSupplier(payload));
      await this.showToast('Proveedor actualizado', 'success');
      this.closeEdit();
      this.load();
    } catch (e: any) {
      await this.showToast(e?.message || 'No se pudo actualizar', 'danger');
    }
  }

  async onDelete() {
    if (!this.supplier) return;
    const alert = await this.alertCtrl.create({
      header: 'Eliminar proveedor',
      message: `¿Seguro que deseas eliminar a <b>${this.supplier.name}</b>? Esta acción no se puede deshacer.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Eliminar', role: 'destructive', handler: () => this.confirmDelete() },
      ],
    });
    await alert.present();
  }

  private async confirmDelete() {
    if (!this.supplier) return;
    try {
      await firstValueFrom(this.supplierSrv.deleteSupplier(this.supplier.id));
      await this.showToast('Proveedor eliminado', 'success');
      this.goBack();
    } catch (e: any) {
      await this.showToast(e?.message || 'No se pudo eliminar', 'danger');
    }
  }

  private toUISupplier(raw: any): UISupplier {
    const nombre   = String(raw?.nombre ?? raw?.name ?? '').trim();
    const correo   = String(raw?.correo ?? raw?.email ?? '' ).trim();
    const telefono = String(raw?.telefono ?? raw?.phone ?? '').trim();
    const address  = String(raw?.direccion ?? raw?.address ?? '').trim();

    const isoReg = raw?.fecha_registro?.toString()?.replace?.(' ', 'T');
    const fr = isoReg ? new Date(isoReg) : undefined;

    return {
      id: String(raw?.id ?? '').trim(),
      name: nombre || '',
      correo: correo || undefined,
      telefono: telefono || undefined,
      address: address || undefined,
      fechaRegistroDate: fr && !Number.isNaN(fr.getTime()) ? fr : undefined,
    };
  }

  private async showToast(message: string, color: 'success' | 'danger') {
    const t = await this.toastCtrl.create({
      message,
      duration: 1800,
      color,
      position: 'bottom',
    });
    await t.present();
  }
}
