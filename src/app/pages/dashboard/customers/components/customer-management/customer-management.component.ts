// src/app/pages/dashboard/customers/components/customer-management/customer-management.component.ts
import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { HttpClientModule } from "@angular/common/http";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import {
  ClientesService,
  ClienteApi,
} from "src/app/core/services/bussiness/clientes.service";
import { ModalController } from "@ionic/angular";
import { ProductCustomerComponent } from "../../../products/components/product-customer/product-customer.component";
import {
  OrderService,
  PedidoApi,
} from "src/app/core/services/bussiness/order.service";

interface ClienteUI extends Omit<ClienteApi, "correo" | "telefono"> {
  correo?: string;
  telefono?: string;
  fechaRegistroDate?: Date;
  pedidosCount: number;
  ultimoPedidoDate: Date | null;
}

@Component({
  selector: "app-customer-management",
  standalone: true,
  templateUrl: "./customer-management.component.html",
  styleUrls: ["./customer-management.component.scss"],
  imports: [
    CommonModule,
    IonicModule,
    HttpClientModule,
    FormsModule,
    RouterModule,
  ],
})
export class CustomerManagementComponent implements OnInit {
  loading = false;
  error?: string;

  clientes: ClienteUI[] = [];
  filtered: ClienteUI[] = [];
  query = "";

  private hydrating = false;
  private resumenCache = new Map<
    string,
    { total: number; last: Date | null }
  >();

  constructor(
    private clientesSrv: ClientesService,
    private orderSrv: OrderService,
    private modalCtrl: ModalController
  ) {}

  ngOnInit() {
    this.load();
  }

  async load(ev?: CustomEvent) {
    this.loading = true;
    this.error = undefined;

    try {
      const raw = await this.clientesSrv.getClientes();
      this.clientes = (raw ?? []).map(this.mapClienteBase);
      this.applyFilter();

      setTimeout(() => this.hydrateInBatches(), 0);
    } catch (e: any) {
      this.error = e?.message || "Error al cargar clientes";
    } finally {
      this.loading = false;
      (ev?.target as HTMLIonRefresherElement)?.complete?.();
    }
  }

  private mapClienteBase = (c: ClienteApi): ClienteUI => {
    const correo = String((c as any).correo ?? (c as any).email ?? "").trim();
    const telefono = String(
      (c as any).telefono ?? (c as any).phone ?? (c as any).celular ?? ""
    ).trim();

    const isoReg = (c as any).fecha_registro?.toString()?.replace?.(" ", "T");
    const fr = isoReg ? new Date(isoReg) : undefined;

    const rawCount =
      (c as any).pedidosCount ??
      (c as any).pedidos ??
      (c as any).total_pedidos ??
      (c as any).cant_pedidos ??
      0;

    const rawLast =
      (c as any).ultimo_pedido ??
      (c as any).fecha_ultimo_pedido ??
      (c as any).fechaUltimoPedido ??
      (c as any).ultimoPedido ??
      null;

    const last =
      typeof rawLast === "string" && rawLast
        ? new Date(rawLast.includes("T") ? rawLast : rawLast.replace(" ", "T"))
        : null;

    return {
      ...(c as any),
      correo: correo || undefined,
      telefono: telefono || undefined,
      fechaRegistroDate: fr && !Number.isNaN(fr.getTime()) ? fr : undefined,
      pedidosCount: Number.isFinite(+rawCount) ? +rawCount : 0,
      ultimoPedidoDate: last && !Number.isNaN(last.getTime()) ? last : null,
    };
  };

  private async hydrateInBatches() {
    if (this.hydrating) return;
    this.hydrating = true;

    const MAX = 4;
    const targets = this.clientes
      .map((c, idx) => ({
        idx,
        id: this.getId(c),
        phone: this.getPhone(c),
      }))
      .filter(
        (x) =>
          x.id &&
          !(this.clientes[x.idx].pedidosCount > 0) &&
          !this.clientes[x.idx].ultimoPedidoDate
      );

    for (let i = 0; i < targets.length; i += MAX) {
      const slice = targets.slice(i, i + MAX);
      await Promise.allSettled(
        slice.map(async ({ id, phone, idx }) => {
          try {
            let cached = this.resumenCache.get(id);
            if (!cached) {
              cached = await this.getResumenSafe(id, phone);
              this.resumenCache.set(id, cached);
            }
            this.clientes[idx].pedidosCount = cached.total ?? 0;
            this.clientes[idx].ultimoPedidoDate = cached.last ?? null;
          } catch {
            
          }
        })
      );

      this.applyFilter();
    }

    this.hydrating = false;
  }

 
  private async getResumenSafe(
    clienteId: string,
    telefono?: string
  ): Promise<{ total: number; last: Date | null }> {
    const id = String(clienteId || "").trim();
    if (!id) return { total: 0, last: null };

    
    try {
      const anySrv = this.orderSrv as any;
      if (typeof anySrv.getResumenByCliente === "function") {
        const r = await anySrv.getResumenByCliente(id);
        return { total: Number(r?.total ?? 0), last: r?.lastDate ?? null };
      }
    } catch {
     
    }

    try {
      const pedidos: PedidoApi[] = await this.orderSrv.getByCliente(id);
      if (Array.isArray(pedidos) && pedidos.length) {
        let last: Date | null = null;
        for (const p of pedidos) {
          const d = this.parseDate(p.fecha);
          if (d && (!last || d.getTime() > last.getTime())) last = d;
        }
        return { total: pedidos.length, last };
      }
    } catch {
     
    }

    const cleanPhone = (telefono || "").toString().replace(/\D/g, "");
    if (cleanPhone) {
      const anySrv = this.orderSrv as any;
      try {
        if (typeof anySrv.getByTelefonoFlat === "function") {
          const arr: PedidoApi[] = await anySrv.getByTelefonoFlat(cleanPhone);
          let last: Date | null = null;
          for (const p of arr) {
            const d = this.parseDate(p.fecha);
            if (d && (!last || d.getTime() > last.getTime())) last = d;
          }
          return { total: arr.length, last };
        } else if (typeof anySrv.getByTelefono === "function") {
          const r = await anySrv.getByTelefono(cleanPhone);
          const arr: PedidoApi[] = [
            ...(r?.pendientes ?? []),
            ...(r?.confirmados ?? []),
            ...(r?.entregados ?? []),
          ];
          let last: Date | null = null;
          for (const p of arr) {
            const d = this.parseDate(p.fecha);
            if (d && (!last || d.getTime() > last.getTime())) last = d;
          }
          return { total: arr.length, last };
        }
      } catch {
        
      }
    }

    return { total: 0, last: null };
  }

  private parseDate(s?: string): Date | null {
    if (!s) return null;
    const iso = s.includes("T") ? s : s.replace(" ", "T");
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }

 
  applyFilter() {
    const q = this.query.trim().toLowerCase();
    if (!q) {
      this.filtered = [...this.clientes];
      return;
    }
    this.filtered = this.clientes.filter((c) => {
      const nombre = (c as any).nombre?.toLowerCase?.() ?? "";
      const correo = (c.correo ?? "").toLowerCase();
      const telefono = (c.telefono ?? "").toLowerCase();
      const direccion = ((c as any).direccion ?? "").toLowerCase();
      return (
        nombre.includes(q) ||
        correo.includes(q) ||
        telefono.includes(q) ||
        direccion.includes(q)
      );
    });
    this.filtered = [...this.filtered];
  }

  clearSearch() {
    this.query = "";
    this.applyFilter();
  }

 
  getId(c: any) {
    return String(c?.id ?? c?.cliente_id ?? c?._id ?? "").trim();
  }
  getPhone(c: any) {
    return String(c?.telefono ?? c?.phone ?? c?.celular ?? "").trim();
  }
  getPedidosLabel(c: ClienteUI) {
    const n = Number(c.pedidosCount ?? 0);
    return `${n} ${n === 1 ? "Pedido" : "Pedidos"}`;
  }
  displaySub(c: ClienteUI) {
    return [c.correo, c.telefono].filter(Boolean).join(" • ");
  }
  trackById = (_: number, c: ClienteUI) => this.getId(c) || _;

  async onAdd() {
    const modal = await this.modalCtrl.create({
      component: ProductCustomerComponent,
      cssClass: "option-select-modal",
      breakpoints: [0, 1],
      initialBreakpoint: 1,
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    if (data?.completed) this.load();
  }
}
