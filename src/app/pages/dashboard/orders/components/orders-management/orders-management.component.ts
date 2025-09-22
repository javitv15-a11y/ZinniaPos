// src/app/pages/dashboard/orders/components/orders-management/orders-management.component.ts
import { Component, OnInit } from "@angular/core";
import { IonicModule, ModalController } from "@ionic/angular";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { HttpClientModule } from "@angular/common/http";

import {
  OrderService,
  PedidoApi,
  PedidoEstado,
} from "src/app/core/services/bussiness/order.service";
import { CreateOrderComponent } from "../create-order/create-order.component";
import {
  ClientesService,
  ClienteApi,
} from "src/app/core/services/bussiness/clientes.service";


type FechaFiltro = "todas" | "hoy" | "7d" | "30d";
type OrigenFiltro = "todos" | "whatsapp" | "app";

interface UiFilters {
  estados: Set<PedidoEstado>;
  origen: OrigenFiltro;
  fecha: FechaFiltro;
}

type PedidoVm = PedidoApi & {
  itemsCount?: number;      
  cliente_nombre?: string;  
};

interface Grouped {
  label: string;
  items: PedidoVm[];
  epoch: number; 
}

@Component({
  selector: "app-orders-management",
  templateUrl: "./orders-management.component.html",
  styleUrls: ["./orders-management.component.scss"],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule, FormsModule, HttpClientModule],
})
export class OrdersManagementComponent implements OnInit {
  loading = false;
  error?: string;

  orders: PedidoVm[] = [];
  filtered: PedidoVm[] = [];
  grouped: Grouped[] = [];

  query = "";

  filters: UiFilters = {
    estados: new Set<PedidoEstado>(),
    origen: "todos",
    fecha: "todas",
  };

  
  isFiltersModalOpen = false;
  filtersPage: "root" | "estado" | "origen" | "fecha" = "root";

 
  private clientesById = new Map<string, string>();
  private clientesByPhone = new Map<string, string>();

  constructor(
    private ordersSrv: OrderService,
    private modalCtrl: ModalController,
    private clientesSrv: ClientesService
  ) {}

  ngOnInit() { this.loadAll(); }

  
  async loadAll() {
    this.loading = true;
    this.error = undefined;

    try {
      const [lista, clientes] = await Promise.all([
        this.ordersSrv.getPedidos() as Promise<PedidoApi[]>,
        this.getClientesSafe(),
      ]);

      this.buildClienteIndices(clientes || []);

      
      this.orders = (lista || []).map((o: any) => {
        const vm: PedidoVm = { ...(o as any) };
        vm.cliente_nombre = this.getClienteNombre(vm);
        vm.itemsCount = this.unitsFromAny(vm);
        return vm;
      });

      this.runFiltersAndGrouping();

      
      await this.hydrateCountsFromDetail(this.orders);
      this.runFiltersAndGrouping();
    } catch (e: any) {
      this.error = e?.message || "Error al cargar pedidos";
      this.orders = [];
      this.filtered = [];
      this.grouped = [];
    } finally {
      this.loading = false;
    }
  }

  private async getClientesSafe(): Promise<ClienteApi[] | null> {
    try { return await this.clientesSrv.getClientes(); } catch { return null; }
  }

  private buildClienteIndices(clientes: ClienteApi[]) {
    this.clientesById.clear();
    this.clientesByPhone.clear();
    for (const c of clientes) {
      const id = String((c as any).id ?? "");
      const nombre = String((c as any).nombre ?? (c as any).name ?? "");
      const tel = String((c as any).telefono ?? (c as any).celular ?? "").replace(/\D/g, "");
      if (id && nombre) this.clientesById.set(id, nombre);
      if (tel && nombre) this.clientesByPhone.set(tel, nombre);
    }
  }

  getClienteNombre(o: any): string {
    const id = String(o?.cliente_id ?? "").trim();
    const tel = String(o?.numero_celular ?? "").replace(/\D/g, "");
    if (id && this.clientesById.has(id)) return this.clientesById.get(id)!;
    if (tel && this.clientesByPhone.has(tel)) return this.clientesByPhone.get(tel)!;
    const emb =
      o?.cliente_nombre || o?.nombre_cliente || o?.cliente?.nombre || o?.cliente?.name || "";
    return String(emb || "");
  }

 
removeFilterChip(kind: "estado" | "origen" | "fecha", value?: PedidoEstado) {
  if (kind === "estado" && value) {
    this.filters.estados.delete(value);
  } else if (kind === "origen") {
    this.filters.origen = "todos";
  } else if (kind === "fecha") {
    this.filters.fecha = "todas";
  }
  this.runFiltersAndGrouping();
}


 
  private unitsFromAny(o: any): number {
    const arr =
      (Array.isArray(o?.items) && o.items) ||
      (Array.isArray(o?.detalle) && o.detalle) ||
      (Array.isArray(o?.detalles) && o.detalles) ||
      (Array.isArray(o?.detalle_pedido) && o.detalle_pedido) ||
      (Array.isArray(o?.detalles_pedido) && o.detalles_pedido) ||
      (Array.isArray(o?.productos) && o.productos) ||
      (Array.isArray(o?.order_items) && o.order_items) ||
      (Array.isArray(o?.line_items) && o.line_items) ||
      null;

    if (arr) {
      let sum = 0;
      for (const it of arr) {
        const rawQty =
          it?.cantidad ?? it?.qty ?? it?.quantity ?? it?.cant ??
          it?.cantidad_producto ?? it?.cantidadProducto ?? it?.units ?? it?.unidades;
        const n = Number(rawQty);
        sum += Number.isFinite(n) && n > 0 ? n : 1;
      }
      return sum;
    }

    
    const fields = [
      o?.cantidad_total, o?.total_cantidad, o?.total_unidades, o?.unidades_total,
      o?.qty_total, o?.quantity_total, o?.sum_cantidades,
      o?.items_count, o?.productos_count, o?.cantidad_items, o?.cantidad_articulos,
      o?.articulos, o?.itemsLength, o?.total_items,
    ]
      .map(v => (v != null ? Number(v) : NaN))
      .filter(n => Number.isFinite(n) && n >= 0) as number[];
    if (fields.length) return Math.max(...fields);

    const len =
      (Array.isArray(o?.items) && o.items.length) ||
      (Array.isArray(o?.detalle) && o.detalle.length) ||
      (Array.isArray(o?.detalles) && o.detalles.length) ||
      (Array.isArray(o?.detalle_pedido) && o.detalle_pedido.length) ||
      (Array.isArray(o?.detalles_pedido) && o.detalles_pedido.length) ||
      (Array.isArray(o?.productos) && o.productos.length) ||
      (Array.isArray(o?.order_items) && o.order_items.length) ||
      (Array.isArray(o?.line_items) && o.line_items.length) || 0;

    return len;
  }

  
  private async hydrateCountsFromDetail(list: PedidoVm[]) {
    const targets = list.filter((o) => {
      const initial = Number(o.itemsCount ?? 0);
      const hasArr =
        (Array.isArray((o as any)?.items) && (o as any).items.length) ||
        (Array.isArray((o as any)?.detalle) && (o as any).detalle.length) ||
        (Array.isArray((o as any)?.productos) && (o as any).productos.length) ||
        (Array.isArray((o as any)?.order_items) && (o as any).order_items.length) ||
        (Array.isArray((o as any)?.line_items) && (o as any).line_items.length);
     
      return !hasArr || initial === 0;
    });

    const concurrency = 5;
    let i = 0;
    const run = async () => {
      while (i < targets.length) {
        const idx = i++;
        const o = targets[idx];
        try {
          const det = await this.fetchDetailById(String(o.id));
          if (det) {
            const units = this.unitsFromAny(det);
            if (units && units !== o.itemsCount) {
              o.itemsCount = units;
              this.runFiltersAndGrouping();
            }
          }
        } catch {}
      }
    };
    const workers = Array.from({ length: Math.min(concurrency, targets.length) }, () => run());
    await Promise.all(workers);
  }

  private async fetchDetailById(id: string): Promise<any | null> {
    const anySrv: any = this.ordersSrv as any;
    if (typeof anySrv.getById === "function") {
      try {
        const res = await anySrv.getById(id);
        const raw = (res && (res.data || res.pedido)) || res;
        return raw || null;
      } catch {}
    }
    try {
      const list = await this.ordersSrv.getPedidos();
      const found = (list || []).find((x: any) => String(x?.id) === id);
      return found || null;
    } catch {}
    return null;
  }

 
  getItemsCount(o: any): number {
    const fromVm = (o as any)?.itemsCount;
    return Number((fromVm ?? this.unitsFromAny(o)) || 0);
  }

  
  get activeFiltersCount(): number {
    let n = 0;
    if (this.filters.estados.size) n++;
    if (this.filters.origen !== "todos") n++;
    if (this.filters.fecha !== "todas") n++;
    return n;
  }
  get estadosArray(): PedidoEstado[] {
    return Array.from(this.filters.estados) as PedidoEstado[];
  }

  openFilters() { this.filtersPage = "root"; this.isFiltersModalOpen = true; }
  closeFilters() { this.isFiltersModalOpen = false; }
  openFiltersPage(p: "estado" | "origen" | "fecha") { this.filtersPage = p; }

  onEstadoChange(estado: PedidoEstado, checked: boolean) {
    if (checked) this.filters.estados.add(estado);
    else this.filters.estados.delete(estado);
    this.runFiltersAndGrouping();
  }
  onFechaChange(v: FechaFiltro) { this.filters.fecha = v; this.runFiltersAndGrouping(); }
  onOrigenChange(v: OrigenFiltro) { this.filters.origen = v; this.runFiltersAndGrouping(); }

  applyQueryFilter() { this.runFiltersAndGrouping(); }
  applyFilters() { this.closeFilters(); this.runFiltersAndGrouping(); }
  clearSearch() { this.query = ""; this.applyQueryFilter(); }
  clearAllFilters() {
    this.filters = { estados: new Set<PedidoEstado>(), origen: "todos", fecha: "todas" };
    this.runFiltersAndGrouping();
  }

  private runFiltersAndGrouping() {
    let arr = [...this.orders] as any[];


    const q = (this.query || "").trim().toLowerCase();
    if (q) {
      arr = arr.filter((o) => {
        const id = (o.id ?? "").toLowerCase();
        const est = (o.estado ?? "").toLowerCase();
        const tel = (o.numero_celular ?? "").toLowerCase();
        const tot = o.total != null ? String(o.total) : "";
        const nom = (o.cliente_nombre ?? this.getClienteNombre(o) ?? "").toLowerCase();
        return id.includes(q) || est.includes(q) || tel.includes(q) || tot.includes(q) || nom.includes(q);
      });
    }


    if (this.filters.estados.size) {
      arr = arr.filter((o) =>
        this.filters.estados.has((o.estado || "").toLowerCase() as PedidoEstado)
      );
    }


    if (this.filters.origen !== "todos") {
      arr = arr.filter((o) => {
        const hasPhone = !!(o.numero_celular && (o.numero_celular + "").replace(/\D/g, "").length >= 7);
        return this.filters.origen === "whatsapp" ? hasPhone : !hasPhone;
      });
    }


    if (this.filters.fecha !== "todas") {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let from: Date | null = null;
      if (this.filters.fecha === "hoy") from = start;
      else if (this.filters.fecha === "7d") from = new Date(start.getTime() - 7 * 86400000);
      else if (this.filters.fecha === "30d") from = new Date(start.getTime() - 30 * 86400000);
      arr = arr.filter((o) => this.asDate((o as any).fecha) >= (from ?? new Date(0)));
    }

    this.filtered = arr as PedidoVm[];

  
    const byDate = new Map<string, { label: string; items: PedidoVm[]; epoch: number }>();
    for (const o of arr) {
      const d = this.asDate((o as any).fecha);
      const key = this.onlyDateISO(d);
      const epoch = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const label = this.dateLabel(d);
      if (!byDate.has(key)) byDate.set(key, { label, items: [], epoch });
      byDate.get(key)!.items.push(o as PedidoVm);
    }

    this.grouped = Array.from(byDate.values())
      .map((g) => ({
        label: g.label,
        epoch: g.epoch,
        items: (g.items as any[]).sort(
          (a, b) =>
            this.asDate((b as any).fecha).getTime() -
            this.asDate((a as any).fecha).getTime()
        ) as PedidoVm[],
      }))
      .sort((a, b) => b.epoch - a.epoch);
  }

  
  estadoSummary(): string {
    const arr = Array.from(this.filters.estados);
    if (!arr.length) return "";
    const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    return arr.map(title).join(", ");
  }
  origenSummary(): string {
    if (this.filters.origen === "whatsapp") return "Whatsapp";
    if (this.filters.origen === "app") return "Aplicación";
    return "";
  }
  fechaSummary(): string {
    const m = { hoy: "Hoy", "7d": "Últimos 7 días", "30d": "Último mes", todas: "" } as const;
    return (m as any)[this.filters.fecha] || "";
  }

 
  asDate(dateLike?: string): Date {
    if (!dateLike) return new Date();
    const t = dateLike.includes("T") ? dateLike : dateLike.replace(" ", "T");
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }
  private onlyDateISO(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }
  private dateLabel(d: Date): string {
    const today = new Date();
    const dOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const tOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const diff = (dOnly - tOnly) / 86400000;
    if (diff === 0) return "Hoy";
    if (diff === -1) return "Ayer";
    const days = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
    return days[d.getDay()];
  }

  
  statusClass(est?: PedidoEstado) {
    const e = (est || "").toLowerCase();
    return { status: true, pending: e === "pendiente", confirmed: e === "confirmado",
             delivered: e === "entregado", canceled: e === "cancelado" };
  }

  trackById(_: number, o: { id: string | number }) { return String(o?.id ?? _); }

  async onAdd() {
    const modal = await this.modalCtrl.create({
      component: CreateOrderComponent,
      cssClass: "option-select-modal",
      breakpoints: [0, 1],
      initialBreakpoint: 1,
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    if (data?.completed) await this.loadAll();
  }

  toPref(o: any) {
    const rawItems =
      (Array.isArray(o?.items) && o.items) ||
      (Array.isArray(o?.detalle) && o.detalle) ||
      (Array.isArray(o?.productos) && o.productos) ||
      (Array.isArray(o?.order_items) && o.order_items) || [];
    const items = rawItems.map((it: any) => ({
      productId: it?.producto_id ?? it?.product_id ?? it?.id ?? it?.producto?.id ?? it?.product?.id,
      productUniqueId: it?.idunico_producto ?? it?.producto?.idunico ?? it?.product?.idunico ?? null,
      nombre: it?.nombre ?? it?.producto_nombre ?? it?.product_name ?? it?.producto?.nombre ?? it?.product?.name,
      cantidad: Number(it?.cantidad ?? it?.qty ?? it?.quantity ?? it?.cant ?? it?.cantidad_producto ?? 1) || 1,
      precio: it?.precio_venta ?? it?.precio ?? undefined,
      subtotal: it?.subtotal ?? it?.total_linea ?? undefined,
      imageUrl: it?.imagen ?? it?.url_imagen ?? it?.image_url ?? it?.producto?.imagen ?? it?.product?.image ?? null,
    }));
    let itemsCount = 0; for (const it of items) itemsCount += Number(it.cantidad || 1);
    return {
      id: String(o?.id ?? ""), estado: o?.estado ?? "", fecha: o?.fecha ?? o?.created_at ?? null,
      total: o?.total ?? null, cliente_id: String(o?.cliente_id ?? o?.cliente?.id ?? ""),
      numero_celular: String(o?.numero_celular ?? o?.cliente?.telefono ?? ""),
      cliente_nombre: this.getClienteNombre(o) || o?.cliente_nombre || o?.nombre_cliente ||
                      o?.cliente?.nombre || o?.cliente?.name || "",
      items, itemsCount,
    };
  }
}
