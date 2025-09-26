// src/app/pages/dashboard/suppliers/components/supplier-management/supplier-management.component.ts
import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule, ModalController } from "@ionic/angular";
import { HttpClientModule } from "@angular/common/http";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";

import { SupplierService } from "src/app/core/services/bussiness/supplier.service";
import { ProductSupplierComponent } from "src/app/pages/dashboard/products/components/product-supplier/product-supplier.component";

type SupplierApi = {
  id: string;
  nombre?: string; // del backend
  telefono?: string;
  correo?: string;
  direccion?: string;
  fecha_registro?: string;
  // variantes posibles
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
};

interface SupplierUI {
  id: string;
  name?: string;
  telefono?: string;
  correo?: string;
  address?: string;
  fechaRegistroDate?: Date;
}

@Component({
  selector: "app-supplier-management",
  standalone: true,
  templateUrl: "./supplier-management.component.html",
  styleUrls: ["./supplier-management.component.scss"],
  imports: [
    CommonModule,
    IonicModule,
    HttpClientModule,
    FormsModule,
    RouterModule,
  ],
})
export class SupplierManagementComponent implements OnInit {
  loading = false;
  error?: string;

  suppliers: SupplierUI[] = [];
  filtered: SupplierUI[] = [];
  query = "";

  constructor(
    private supplierSrv: SupplierService,
    private modalCtrl: ModalController
  ) {}

  ngOnInit() {
    this.load();
  }

  async load(ev?: CustomEvent) {
    this.loading = true;
    this.error = undefined;

    try {
      const raw = await this.supplierSrv.getAllSuppliers().toPromise();
      this.suppliers = (raw ?? []).map(this.mapSupplierBase);
      this.applyFilter();
    } catch (e: any) {
      this.error = e?.message || "Error al cargar proveedores";
    } finally {
      this.loading = false;
      (ev?.target as HTMLIonRefresherElement)?.complete?.();
    }
  }

  private mapSupplierBase = (s: SupplierApi): SupplierUI => {
    const nombre = (s.name ?? s.nombre ?? "").toString().trim();
    const correo = (s.correo ?? s.email ?? "").toString().trim();
    const telefono = (s.telefono ?? s.phone ?? "").toString().trim();
    const address = (s.direccion ?? s.address ?? "").toString().trim();

    const isoReg = s.fecha_registro?.toString()?.replace?.(" ", "T");
    const fr = isoReg ? new Date(isoReg) : undefined;

    return {
      id: String(s.id ?? "").trim(),
      name: nombre || undefined,
      correo: correo || undefined,
      telefono: telefono || undefined,
      address: address || undefined,
      fechaRegistroDate: fr && !Number.isNaN(fr.getTime()) ? fr : undefined,
    };
  };

  applyFilter() {
    const q = this.query.trim().toLowerCase();
    if (!q) {
      this.filtered = [...this.suppliers];
      return;
    }
    this.filtered = this.suppliers.filter((s) => {
      const name = (s.name ?? "").toLowerCase();
      const correo = (s.correo ?? "").toLowerCase();
      const telefono = (s.telefono ?? "").toLowerCase();
      const address = (s.address ?? "").toLowerCase();
      return (
        name.includes(q) ||
        correo.includes(q) ||
        telefono.includes(q) ||
        address.includes(q)
      );
    });
    this.filtered = [...this.filtered];
  }

  clearSearch() {
    this.query = "";
    this.applyFilter();
  }

  getId(s: SupplierUI | any) {
    return String(s?.id ?? s?.proveedor_id ?? s?._id ?? "").trim();
  }

  public displaySub(s: SupplierUI): string {
    return [s.correo, s.telefono].filter(Boolean).join(" • ");
  }

  trackById = (_: number, s: SupplierUI) => this.getId(s) || _;

  async onAdd() {
    const modal = await this.modalCtrl.create({
      component: ProductSupplierComponent,
      cssClass: "option-select-modal",
      breakpoints: [0, 1],
      initialBreakpoint: 1,
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    if (data?.completed) this.load();
  }
}
