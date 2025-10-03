// src/app/pages/dashboard/customers/components/customer-detail/customer-detail.component.ts
import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  IonicModule,
  NavController,
  ToastController,
  AlertController,
} from "@ionic/angular";
import { HttpClientModule } from "@angular/common/http";
import { ActivatedRoute } from "@angular/router";
import { FormsModule } from "@angular/forms";

import { ClientesService } from "src/app/core/services/bussiness/clientes.service";
import {
  OrderService,
  PedidoApi,
} from "src/app/core/services/bussiness/order.service";

type UIOrderStatus =
  | "Pendiente"
  | "Confirmado"
  | "Entregado"
  | "Cancelado"
  | string;

interface UICustomer {
  id: string;
  nombre: string;
  correo?: string;
  telefono?: string;
  direccion?: string;
}

interface UIOrder {
  id: string;
  status: UIOrderStatus;
  date?: Date | null;
  itemsCount: number;
  total: number;
}

// Si tienes una interfaz en tu core, úsala.
// Aquí dejo una local para no romper imports.
interface UpdateCustomerPayload {
  id: string;
  nombre?: string;
  correo?: string;
  telefono?: string;
  direccion?: string;
}

@Component({
  selector: "app-customer-detail",
  standalone: true,
  imports: [CommonModule, IonicModule, HttpClientModule, FormsModule],
  templateUrl: "./customer-detail.component.html",
  styleUrls: ["./customer-detail.component.scss"],
})
export class CustomerDetailComponent implements OnInit {
  loading = false;
  error?: string;

  customer?: UICustomer | null;
  orders: UIOrder[] = [];

  private id = "";
  private originalById = new Map<string, any>();

  // --- Estado del modal de edición ---
  editOpen = false;
  edit: {
    nombre: string;
    correo: string;
    telefono: string;
    direccion: string;
  } = {
    nombre: "",
    correo: "",
    telefono: "",
    direccion: "",
  };

  constructor(
    private route: ActivatedRoute,
    private nav: NavController,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private clientesSrv: ClientesService,
    private orderSrv: OrderService
  ) {}

  ngOnInit(): void {
    this.id = String(this.route.snapshot.paramMap.get("id") || "");
    this.load();
  }

  async load(ev?: CustomEvent) {
    this.loading = true;
    this.error = undefined;
    try {
      await this.loadCustomer();
      await this.loadOrdersWithFallback();
      this.hydrateCountsFromDetail();
    } catch (e: any) {
      this.error = e?.message || "No se pudo cargar el cliente";
    } finally {
      this.loading = false;
      (ev?.target as HTMLIonRefresherElement)?.complete?.();
    }
  }

  goBack() {
    if (history.length > 1) this.nav.back();
    else this.nav.navigateBack(["/customers"]);
  }

  // =====================
  // Edición / Eliminación
  // =====================
  openEdit() {
    if (!this.customer) return;
    this.edit = {
      nombre: this.customer.nombre || "",
      correo: this.customer.correo || "",
      telefono: this.customer.telefono || "",
      direccion: this.customer.direccion || "",
    };
    this.editOpen = true;
  }

  closeEdit() {
    this.editOpen = false;
  }

  async saveEdit() {
    if (!this.customer) return;

    const payload = {
      id: String(this.customer.id).trim(),
      nombre: (this.edit.nombre || "").trim(),
      correo: (this.edit.correo || "").trim(),
      telefono: (this.edit.telefono || "").trim(),
      direccion: (this.edit.direccion || "").trim(),
    };

    try {
      const res = await this.clientesSrv.updateCliente(payload);

      if (res.changed) {
        await this.showToast("Cliente actualizado", "success");
      } else {
        await this.showToast("Sin cambios para guardar", "success");
      }

      this.closeEdit();
      this.load();
    } catch (e: any) {
      await this.showToast(
        e?.message || "No se pudo actualizar el cliente",
        "danger"
      );
    }
  }

  async onDelete() {
    if (!this.customer) return;
    const alert = await this.alertCtrl.create({
      header: "Eliminar cliente",
      message: `¿Seguro que deseas eliminar a <b>${
        this.customer.nombre || "este cliente"
      }</b>? Esta acción no se puede deshacer.`,
      buttons: [
        { text: "Cancelar", role: "cancel" },
        {
          text: "Eliminar",
          role: "destructive",
          handler: () => this.confirmDelete(),
        },
      ],
    });
    await alert.present();
  }

  private async confirmDelete() {
    if (!this.customer) return;
    try {
      const anySrv: any = this.clientesSrv as any;
      if (typeof anySrv.deleteCliente === "function") {
        await anySrv.deleteCliente(this.customer.id);
      } else if (typeof anySrv.deleteById === "function") {
        await anySrv.deleteById(this.customer.id);
      } else if (typeof anySrv.remove === "function") {
        await anySrv.remove(this.customer.id);
      } else if (typeof anySrv.delete === "function") {
        await anySrv.delete(this.customer.id);
      } else {
        throw new Error(
          "El servicio de clientes no expone método de eliminación"
        );
      }

      await this.showToast("Cliente eliminado", "success");
      this.goBack();
    } catch (e: any) {
      await this.showToast(
        e?.message || "No se pudo eliminar el cliente",
        "danger"
      );
    }
  }

  // =====================
  // Carga de datos
  // =====================
  private async loadCustomer() {
    let raw: any = null;
    const anySrv: any = this.clientesSrv as any;
    if (typeof anySrv.getClienteById === "function") {
      raw = await anySrv.getClienteById(this.id);
    } else if (typeof anySrv.getById === "function") {
      raw = await anySrv.getById(this.id);
    } else {
      const list: any[] = await this.clientesSrv.getClientes();
      raw =
        list.find(
          (x: any) => String(x?.id ?? x?._id ?? x?.cliente_id ?? "") === this.id
        ) ?? null;
    }

    if (!raw) {
      this.customer = null;
      throw new Error("Cliente no encontrado");
    }

    this.customer = this.toUICustomer(raw);
  }

  private async loadOrdersWithFallback() {
    let arr: PedidoApi[] = [];
    try {
      arr = await this.orderSrv.getByCliente(this.id);
    } catch {}

    const phone = (this.customer?.telefono || "").toString().replace(/\D/g, "");
    if ((!arr || arr.length === 0) && phone) {
      const srv: any = this.orderSrv as any;
      try {
        if (typeof srv.getByTelefonoFlat === "function") {
          arr = await srv.getByTelefonoFlat(phone);
        } else if (typeof srv.getByTelefono === "function") {
          const r = await srv.getByTelefono(phone);
          arr = [
            ...(r?.pendientes ?? []),
            ...(r?.confirmados ?? []),
            ...(r?.entregados ?? []),
          ];
        }
      } catch {}
    }

    this.orders = (arr ?? []).map(this.toUIOrder).sort((a, b) => {
      const ta = a.date ? a.date.getTime() : 0;
      const tb = b.date ? b.date.getTime() : 0;
      return tb - ta;
    });
  }

  // =====================
  // Mapeos y utilidades
  // =====================
  private toUICustomer = (c: any): UICustomer => ({
    id: String(c?.id ?? c?._id ?? c?.cliente_id ?? ""),
    nombre: String(c?.nombre ?? c?.name ?? "").trim(),
    correo: (c?.correo ?? c?.email ?? "") || undefined,
    telefono: (c?.telefono ?? c?.phone ?? c?.celular ?? "") || undefined,
    direccion: (c?.direccion ?? c?.address ?? "") || undefined,
  });

  private toUIOrder = (o: PedidoApi): UIOrder => {
    this.originalById.set(String(o.id), o);

    const dateStr = String(o.fecha ?? o.created_at ?? "").replace(" ", "T");
    const d = dateStr ? new Date(dateStr) : null;

    const itemsCount = this.unitsFromAny(o);

    const s = String(o.estado ?? "").toLowerCase();
    const status: UIOrderStatus =
      s === "pendiente"
        ? "Pendiente"
        : s === "confirmado"
        ? "Confirmado"
        : s === "entregado"
        ? "Entregado"
        : s === "cancelado"
        ? "Cancelado"
        : (o as any).estado || "";

    return {
      id: String(o.id),
      status,
      date: d && !Number.isNaN(d.getTime()) ? d : null,
      itemsCount,
      total: Number(o.total ?? 0),
    };
  };

  private unitsFromAny(o: any): number {
    const arr =
      (Array.isArray(o?.items) && o.items) ||
      (Array.isArray(o?.detalle) && o.detalle) ||
      (Array.isArray(o?.detalles) && o.detalles) ||
      (Array.isArray(o?.detalle_pedido) && o.detalle_pedido) ||
      (Array.isArray(o?.detalles_pedido) && o.detalles_pedido) ||
      (Array.isArray(o?.detallePedido) && o.detallePedido) ||
      (Array.isArray(o?.detallesPedido) && o.detallesPedido) ||
      (Array.isArray(o?.productos) && o.productos) ||
      (Array.isArray(o?.productosPedido) && o.productosPedido) ||
      (Array.isArray(o?.itemsPedido) && o.itemsPedido) ||
      (Array.isArray(o?.order_items) && o.order_items) ||
      (Array.isArray(o?.line_items) && o.line_items) ||
      null;

    if (arr) {
      let sum = 0;
      for (const it of arr) {
        const rawQty =
          it?.cantidad ??
          it?.qty ??
          it?.quantity ??
          it?.cant ??
          it?.cantidad_producto ??
          it?.cantidadProducto ??
          it?.units ??
          it?.unidades ??
          it?.cantidadItem ??
          it?.cantidadArticulos ??
          it?.cantidadPedido;
        const n = Number(rawQty);
        sum += Number.isFinite(n) && n > 0 ? n : 1;
      }
      return sum;
    }

    const fields = [
      o?.cantidad_total,
      o?.total_cantidad,
      o?.total_unidades,
      o?.unidades_total,
      o?.qty_total,
      o?.quantity_total,
      o?.sum_cantidades,
      o?.items_count,
      o?.productos_count,
      o?.cantidad_items,
      o?.cantidad_articulos,
      o?.articulos,
      o?.itemsLength,
      o?.total_items,
      o?.totalItems,
    ]
      .map((v) => (v != null ? Number(v) : NaN))
      .filter((n) => Number.isFinite(n) && n >= 0) as number[];
    if (fields.length) return Math.max(...fields);

    const len =
      (Array.isArray(o?.items) && o.items.length) ||
      (Array.isArray(o?.detalle) && o.detalle.length) ||
      (Array.isArray(o?.detalles) && o.detalles.length) ||
      (Array.isArray(o?.detalle_pedido) && o.detalle_pedido.length) ||
      (Array.isArray(o?.detalles_pedido) && o.detalles_pedido.length) ||
      (Array.isArray(o?.detallePedido) && o.detallePedido.length) ||
      (Array.isArray(o?.detallesPedido) && o.detallesPedido.length) ||
      (Array.isArray(o?.productos) && o.productos.length) ||
      (Array.isArray(o?.productosPedido) && o.productosPedido.length) ||
      (Array.isArray(o?.itemsPedido) && o.itemsPedido.length) ||
      (Array.isArray(o?.order_items) && o.order_items.length) ||
      (Array.isArray(o?.line_items) && o.line_items.length) ||
      0;

    return len;
  }

  private toPref(o: any) {
    const rawItems =
      (Array.isArray(o?.items) && o.items) ||
      (Array.isArray(o?.detalle) && o.detalle) ||
      (Array.isArray(o?.detalles) && o.detalles) ||
      (Array.isArray(o?.detalle_pedido) && o.detalle_pedido) ||
      (Array.isArray(o?.detalles_pedido) && o.detalles_pedido) ||
      (Array.isArray(o?.order_items) && o.order_items) ||
      (Array.isArray(o?.line_items) && o.line_items) ||
      (Array.isArray(o?.productos) && o.productos) ||
      [];

    const items = rawItems.map((it: any) => ({
      productId:
        it?.producto_id ??
        it?.product_id ??
        it?.id ??
        it?.producto?.id ??
        it?.product?.id,
      productUniqueId:
        it?.idunico_producto ??
        it?.producto?.idunico ??
        it?.product?.idunico ??
        null,
      nombre:
        it?.nombre ??
        it?.producto_nombre ??
        it?.product_name ??
        it?.producto?.nombre ??
        it?.product?.name,
      cantidad:
        Number(
          it?.cantidad ??
            it?.qty ??
            it?.quantity ??
            it?.cant ??
            it?.cantidad_producto ??
            1
        ) || 1,
      precio: it?.precio_venta ?? it?.precio ?? undefined,
      subtotal: it?.subtotal ?? it?.total_linea ?? undefined,
      imageUrl:
        it?.imagen ??
        it?.url_imagen ??
        it?.image_url ??
        it?.producto?.imagen ??
        it?.product?.image ??
        null,
    }));

    let itemsCount = 0;
    for (const it of items) itemsCount += Number(it.cantidad || 1);

    const dateStr = String(
      o?.fecha ?? o?.created_at ?? o?.fecha_pedido ?? o?.fecha_creacion ?? ""
    ).replace(" ", "T");
    const fecha = dateStr ? new Date(dateStr) : null;

    const total = o?.total ?? o?.monto_total ?? o?.importe ?? null;

    return {
      id: String(o?.id ?? ""),
      estado: o?.estado ?? o?.status ?? "",
      fecha: fecha && !Number.isNaN(fecha.getTime()) ? fecha : null,
      total: total != null ? Number(total) : null,
      cliente_id: String(
        o?.cliente_id ?? o?.cliente?.id ?? o?.customer_id ?? ""
      ),
      numero_celular: String(
        o?.numero_celular ??
          o?.telefono ??
          o?.celular ??
          o?.cliente?.telefono ??
          ""
      ),
      cliente_nombre:
        o?.cliente_nombre ||
        o?.nombre_cliente ||
        o?.cliente?.nombre ||
        o?.cliente?.name ||
        "",
      cliente_correo: o?.cliente?.correo ?? o?.cliente?.email ?? undefined,
      cliente_direccion:
        o?.cliente?.direccion ?? o?.cliente?.address ?? undefined,
      items,
      itemsCount,
    };
  }

  async openOrder(id: string) {
    let raw = this.originalById.get(String(id));

    if (
      (!raw || this.unitsFromAny(raw) === 0) &&
      typeof (this.orderSrv as any).getById === "function"
    ) {
      try {
        const res = await (this.orderSrv as any).getById(String(id));
        raw = (res && (res.data || res.pedido)) || res || null;
      } catch {}
    }

    const pref = raw
      ? this.toPref(raw)
      : { id: String(id), items: [], itemsCount: 0 };

    this.nav.navigateForward(["/dashboard", "orders", "order", id], {
      state: { pref, fromCustomer: true },
    });
  }

  private async hydrateCountsFromDetail() {
    const srv: any = this.orderSrv as any;
    if (typeof srv.getById !== "function") return;

    const targets = this.orders.filter(
      (o) => !o.itemsCount || o.itemsCount === 0
    );
    if (!targets.length) return;

    const concurrency = 5;
    let i = 0;
    const run = async () => {
      while (i < targets.length) {
        const idx = i++;
        const ui = targets[idx];
        try {
          const res = await srv.getById(String(ui.id));
          const det = (res && (res.data || res.pedido)) || res || null;
          if (det) {
            const units = this.unitsFromAny(det);
            if (
              Number.isFinite(units) &&
              units >= 0 &&
              units !== ui.itemsCount
            ) {
              ui.itemsCount = units;
              this.originalById.set(String(ui.id), det);
            }
          }
        } catch {}
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(concurrency, targets.length) }, () => run())
    );
  }

  pillClass(o: UIOrder) {
    const s = (o.status || "").toLowerCase();
    if (s.includes("pend")) return "pill pill--pendiente";
    if (s.includes("conf")) return "pill pill--confirmado";
    if (s.includes("entre") || s.includes("entreg"))
      return "pill pill--entregado";
    if (s.includes("canc")) return "pill pill--cancelado";
    return "pill";
  }

  trackOrderId(_: number, o: UIOrder) {
    return o.id;
  }

  private async showToast(message: string, color: "success" | "danger") {
    const t = await this.toastCtrl.create({
      message,
      duration: 1800,
      color,
      position: "bottom",
    });
    await t.present();
  }
}
