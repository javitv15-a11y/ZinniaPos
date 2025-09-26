import { CommonModule } from "@angular/common";
import { Component, OnInit, ChangeDetectorRef, OnDestroy } from "@angular/core";
import { IonicModule, NavController } from "@ionic/angular";
import { HttpClientModule, HttpClient } from "@angular/common/http";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom } from "rxjs";

import {
  OrderService,
  PedidoApi,
} from "src/app/core/services/bussiness/order.service";
import {
  ClientesService,
  ClienteApi,
} from "src/app/core/services/bussiness/clientes.service";
import {
  ProductService,
  ProductApi,
} from "src/app/core/services/bussiness/product.service";

type UIEstado = "Pendiente" | "Confirmado" | "Entregado" | "Cancelado" | string;

interface UIItem {
  productId?: string;
  productUniqueId?: string | null;
  imageUrl?: string | null;
  nombre?: string;
  cantidad: number;
  precio?: number;
  subtotal?: number;
}

interface UIOrderDetail {
  id: string;
  estado: UIEstado;
  fecha?: Date | null;
  total?: number | null;

  items: UIItem[];
  itemsCount: number;

  // cliente
  cliente_id?: string;
  numero_celular?: string;
  cliente_nombre?: string;
  cliente_correo?: string;
  cliente_direccion?: string;
}

const API_FILES_BASE: string = "";

@Component({
  standalone: true,
  selector: "app-order-detail",
  templateUrl: "./orders-detail.component.html",
  styleUrls: ["./orders-detail.component.scss"],
  imports: [CommonModule, IonicModule, HttpClientModule],
})
export class OrderDetailComponent implements OnInit, OnDestroy {
  loading = false;
  error?: string;
  order?: UIOrderDetail | null;

  private id = "";
  hideClientBlock = false;

  private prodById = new Map<string, ProductApi>();
  private prodByUnique = new Map<string, ProductApi>();
  private prodByName = new Map<string, ProductApi>();
  private imgCache = new Map<string, string | null>();
  private blobUrls: string[] = [];

  constructor(
    private route: ActivatedRoute,
    private nav: NavController,
    private ordersSrv: OrderService,
    private clientesSrv: ClientesService,
    private productsSrv: ProductService,
    private http: HttpClient,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.id = String(this.route.snapshot.paramMap.get("id") || "");

    const st = (history.state && history.state.pref) || {};
    this.hideClientBlock = !!history.state?.fromCustomer;

    if (st && (st.id || this.id)) {
      const preItems: UIItem[] = Array.isArray(st.items)
        ? st.items.map((it: any) => ({
            productId: it.productId ? String(it.productId) : undefined,
            productUniqueId:
              it.productUniqueId != null ? String(it.productUniqueId) : null,
            imageUrl: this.toStringUrl(it.imageUrl ?? null),
            nombre: it.nombre,
            cantidad: Number(it.cantidad ?? 1) || 1,
            precio:
              it.precio != null
                ? Number(it.precio)
                : it.precio_venta != null
                ? Number(it.precio_venta)
                : undefined,
            subtotal: it.subtotal != null ? Number(it.subtotal) : undefined,
          }))
        : [];

      const count =
        Number(st.itemsCount ?? 0) ||
        preItems.reduce((a, b) => a + (b.cantidad || 1), 0);

      this.order = {
        id: String(st.id || this.id),
        // Puede venir "Pendiente" u otro; el merge elegirá siempre el primer NO vacío privilegiando fresh.
        estado: (st.estado as UIEstado) ?? (undefined as any),
        fecha: st.fecha ? new Date(String(st.fecha).replace(" ", "T")) : null,
        total: st.total != null ? Number(st.total) : null,
        items: preItems,
        itemsCount: count,
        cliente_id: st.cliente_id ? String(st.cliente_id) : "",
        numero_celular: st.numero_celular ? String(st.numero_celular) : "",
        cliente_nombre: st.cliente_nombre || undefined,
        cliente_correo: st.cliente_correo || undefined,
        cliente_direccion: st.cliente_direccion || undefined,
      };
    }

    this.load();
  }

  ngOnDestroy(): void {
    for (const u of this.blobUrls) URL.revokeObjectURL(u);
    this.blobUrls = [];
  }

  async load(ev?: CustomEvent) {
    this.loading = true;
    this.error = undefined;
    try {
      const fresh = await this.fetchOrder();
      this.order = this.mergeOrders(this.order ?? null, fresh);

      if (this.order) {
        if (!this.order.itemsCount || this.order.itemsCount < 1) {
          this.order.itemsCount = (this.order.items || []).reduce(
            (a, it) => a + Number(it.cantidad || 0),
            0
          );
        }
        const t = this.computeTotal(this.order);
        if (t != null) this.order.total = t;
      }

      if (!this.hideClientBlock) {
        await this.inflateCustomerFields();
      }

      await this.ensureProductIndexes();
      await this.inflateItemNamesIfMissing();
      await this.hydrateItemImages();

      this.cd.detectChanges();
    } catch (e: any) {
      this.error = e?.message || "No se pudo cargar el pedido";
    } finally {
      this.loading = false;
      (ev?.target as HTMLIonRefresherElement)?.complete?.();
    }
  }

  // =================== Helpers ===================
  // Devuelve el primer string no vacío
  private pickNonEmpty(
    ...vals: Array<string | null | undefined>
  ): string | undefined {
    for (const v of vals) {
      const s = (v ?? "").toString().trim();
      if (s) return s;
    }
    return undefined;
  }

  // =================== Data fetch & merge ===================
  private async fetchOrder(): Promise<UIOrderDetail> {
    let raw: any | null = null;
    const anySrv: any = this.ordersSrv as any;

    if (typeof anySrv.getById === "function") {
      raw = await this.resolveMaybe<any>(anySrv.getById(this.id));
    } else {
      try {
        const list = await this.resolveMaybe<PedidoApi[]>(
          this.ordersSrv.getPedidos() as any
        );
        raw =
          (list || []).find((x) => String((x as any).id) === this.id) ?? null;
      } catch {
        raw = null;
      }
    }

    if (!raw) throw new Error("Pedido no encontrado");

    if (raw?.data && typeof raw.data === "object") raw = raw.data;
    if (raw?.pedido && typeof raw.pedido === "object") raw = raw.pedido;

    return this.toUIOrder(raw as PedidoApi);
  }

  private mergeOrders(
    pref: UIOrderDetail | null,
    fresh: UIOrderDetail
  ): UIOrderDetail {
    if (!pref) {
      return {
        ...fresh,
        estado: this.pickNonEmpty(fresh.estado, "Pendiente") as UIEstado,
      };
    }
    return {
      id: this.pickNonEmpty(fresh.id, pref.id)!,
      estado: this.pickNonEmpty(
        fresh.estado,
        pref.estado,
        "Pendiente"
      ) as UIEstado,
      fecha: fresh.fecha ?? pref.fecha,
      total: fresh.total ?? pref.total,
      items: fresh.items?.length ? fresh.items : pref.items,
      itemsCount: fresh.itemsCount || pref.itemsCount || 0,
      cliente_id: this.pickNonEmpty(fresh.cliente_id, pref.cliente_id),
      numero_celular: this.pickNonEmpty(
        fresh.numero_celular,
        pref.numero_celular
      ),
      cliente_nombre: this.pickNonEmpty(
        fresh.cliente_nombre,
        pref.cliente_nombre
      ),
      cliente_correo: this.pickNonEmpty(
        fresh.cliente_correo,
        pref.cliente_correo
      ),
      cliente_direccion: this.pickNonEmpty(
        fresh.cliente_direccion,
        pref.cliente_direccion
      ),
    };
  }

  // ============== Cliente ==============
  private getFullName(c: any): string {
    const n =
      c?.nombre ??
      c?.name ??
      (c?.nombres && c?.apellidos ? `${c.nombres} ${c.apellidos}` : "");
    return String(n ?? "").trim();
  }

  private async inflateCustomerFields() {
    if (!this.order) return;

    let found: any | undefined;
    const id = String(this.order.cliente_id || "");
    const tel = String(this.order.numero_celular || "").replace(/\D/g, "");

    try {
      const list = await this.resolveMaybe<ClienteApi[]>(
        this.clientesSrv.getClientes() as any
      );

      if (id) {
        found = list.find(
          (c: any) => String(c?.id ?? c?._id ?? c?.cliente_id ?? "") === id
        );
      }
      if (!found && tel) {
        found = list.find(
          (c: any) =>
            String(c?.telefono ?? c?.celular ?? "").replace(/\D/g, "") === tel
        );
      }

      if (found) {
        if (!this.order.cliente_nombre) {
          this.order.cliente_nombre = this.getFullName(found) || undefined;
        }
        if (!this.order.cliente_correo) {
          const mail = (found as any).correo ?? (found as any).email ?? "";
          this.order.cliente_correo = mail || undefined;
        }
        if (!this.order.cliente_direccion) {
          const addr =
            (found as any).direccion ??
            (found as any).address ??
            (found as any).domicilio ??
            "";
          this.order.cliente_direccion = addr || undefined;
        }
        if (!this.order.numero_celular) {
          const p = (found as any).telefono ?? (found as any).celular ?? "";
          this.order.numero_celular = p ? String(p) : undefined;
        }
      }
    } catch {}
  }

  // ============== Productos (índices / helpers) ==============
  private normalizeName(s: any): string {
    return String(s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  private async ensureProductIndexes() {
    if (this.prodById.size) return;
    try {
      const list = await this.resolveMaybe<ProductApi[]>(
        this.productsSrv.getAll() as any
      );
      for (const p of list) {
        const id = String((p as any).id ?? "");
        const uid =
          String((p as any).idunico ?? (p as any).id_unico ?? "") || null;
        const nombre =
          (p as any).nombre ?? (p as any).name ?? (p as any).titulo ?? "";

        if (id) this.prodById.set(id, p);
        if (uid) this.prodByUnique.set(uid, p);
        const key = this.normalizeName(nombre);
        if (key) this.prodByName.set(key, p);
      }
    } catch {}
  }

  private async inflateItemNamesIfMissing() {
    if (!this.order?.items?.length) return;
    for (const it of this.order.items) {
      if (it.nombre && it.nombre.trim()) continue;

      let p: ProductApi | undefined;
      if (it.productId && this.prodById.has(it.productId)) {
        p = this.prodById.get(it.productId)!;
      } else if (
        it.productUniqueId &&
        this.prodByUnique.has(String(it.productUniqueId))
      ) {
        p = this.prodByUnique.get(String(it.productUniqueId))!;
      }
      if (!p && it.nombre) {
        const key = this.normalizeName(it.nombre);
        p = this.prodByName.get(key);
      }
      if (p) {
        it.nombre =
          (p as any).nombre ??
          (p as any).name ??
          (p as any).titulo ??
          "Artículo";
      }
    }
  }

  private toStringUrl(u: any): string | null {
    const s =
      typeof u === "string"
        ? u
        : u?.url ?? u?.src ?? u?.imageUrl ?? u?.image ?? null;
    if (!s) return null;
    if (/^(https?:|data:|blob:)/i.test(s)) return s;
    if (!API_FILES_BASE) return s;
    return `${API_FILES_BASE.replace(/\/$/, "")}/${String(s).replace(
      /^\//,
      ""
    )}`;
  }

  private computeTotal(o?: UIOrderDetail | null): number | null {
    if (!o) return null;
    if (o.total != null && Number.isFinite(Number(o.total))) {
      return Number(o.total);
    }
    const t = (o.items || []).reduce((acc, it) => {
      if (it?.subtotal != null && Number.isFinite(Number(it.subtotal))) {
        return acc + Number(it.subtotal);
      }
      const precio = Number(it?.precio ?? 0);
      const cant = Number(it?.cantidad ?? 0);
      return (
        acc +
        (Number.isFinite(precio) && Number.isFinite(cant) ? precio * cant : 0)
      );
    }, 0);
    return Number.isFinite(t) ? t : null;
  }

  get totalCalculado(): number | null {
    return this.computeTotal(this.order);
  }

  private async ensureDisplayable(url: string | null): Promise<string | null> {
    if (!url) return null;
    const resolved = this.toStringUrl(url);
    if (!resolved) return null;

    if (/^(data:|blob:)/i.test(resolved)) return resolved;

    try {
      const blob = await firstValueFrom(
        this.http.get(resolved, { responseType: "blob" as const })
      );
      const objUrl = URL.createObjectURL(blob);
      this.blobUrls.push(objUrl);
      return objUrl;
    } catch {
      return resolved;
    }
  }

  private collectImagesFromApi(p: any): string[] {
    const arr =
      (Array.isArray(p?.imagenes) && p.imagenes) ||
      (Array.isArray(p?.images) && p.images) ||
      (Array.isArray(p?.fotos) && p.fotos) ||
      [];
    const single =
      p?.imagen ||
      p?.image ||
      p?.url_imagen ||
      p?.urlImagen ||
      p?.imagen_portada_url ||
      p?.portada ||
      p?.thumbnail ||
      null;

    const out: string[] = [];
    for (const x of arr) {
      const url = this.toStringUrl(x);
      if (url) out.push(url);
    }
    const uno = this.toStringUrl(single);
    if (uno) out.push(uno);
    return out;
  }

  private async resolveMaybe<T>(v: any): Promise<T> {
    if (v && typeof v.then === "function") return await v;
    if (v && typeof v.subscribe === "function") return await firstValueFrom(v);
    return v as T;
  }

  private async fetchCoverFor(
    id: string,
    unique?: string | null
  ): Promise<string | null> {
    try {
      let res: any;
      if (unique) {
        res = await this.resolveMaybe<any>(
          this.productsSrv.getCoverUrl({ id, idunico: unique } as any)
        );
      } else {
        res = await this.resolveMaybe<any>(
          (this.productsSrv.getCoverUrl as any)(id)
        );
      }
      return this.toStringUrl(res);
    } catch {
      return null;
    }
  }

  private async fetchFirstImageFor(
    id: string,
    unique?: string | null
  ): Promise<string | null> {
    try {
      let imgs: any = unique
        ? await this.resolveMaybe<any>(
            this.productsSrv.getImages({ id, idunico: unique } as any)
          )
        : await this.resolveMaybe<any>(
            this.productsSrv.getImages({ id } as any)
          );

      if (Array.isArray(imgs)) {
        for (const it of imgs) {
          const url = this.toStringUrl(it);
          if (url) return url;
        }
        return null;
      }
      return this.toStringUrl(imgs);
    } catch {
      return null;
    }
  }

  private async hydrateItemImages() {
    if (!this.order?.items?.length) return;

    if (!this.prodById.size) {
      try {
        const list = await this.resolveMaybe<ProductApi[]>(
          this.productsSrv.getAll() as any
        );
        for (const p of list) {
          const id = String((p as any).id ?? "");
          if (id) this.prodById.set(id, p);
        }
      } catch {}
    }

    const tasks = this.order.items.map(async (it) => {
      if (it.imageUrl) return;

      const pid = String(it.productId ?? "");
      if (!pid) return;

      if (this.imgCache.has(pid)) {
        it.imageUrl = this.imgCache.get(pid) || undefined;
        return;
      }

      const p = this.prodById.get(pid);
      const idunico = p
        ? String((p as any).idunico ?? (p as any).id_unico ?? "") || undefined
        : undefined;

      let url: string | null = null;
      try {
        url = idunico
          ? await this.resolveMaybe<string>(
              this.productsSrv.getCoverUrl({ id: pid, idunico } as any)
            )
          : await this.resolveMaybe<string>(
              (this.productsSrv.getCoverUrl as any)(pid)
            );
      } catch {
        url = null;
      }

      this.imgCache.set(pid, url ?? null);
      if (url) it.imageUrl = url;
    });

    await Promise.allSettled(tasks);
  }

  private toUIOrder(o: any): UIOrderDetail {
    const oid =
      o?.id ?? o?._id ?? o?.pedido_id ?? o?.order_id ?? o?.codigo ?? "";

    const dateStr = String(
      o?.fecha ??
        o?.fecha_pedido ??
        o?.fecha_creacion ??
        o?.created_at ??
        o?.createdAt ??
        o?.updated_at ??
        ""
    ).replace(" ", "T");
    const d = dateStr ? new Date(dateStr) : null;

    const s = String(o?.estado ?? o?.status ?? "")
      .toLowerCase()
      .trim();

    // Mapeo con sinónimos y luego fallback
    let estadoMapped: UIEstado = s.includes("pend")
      ? "Pendiente"
      : s.includes("conf")
      ? "Confirmado"
      : s.includes("entreg")
      ? "Entregado"
      : s.includes("cancel") || s.includes("anul") || s.includes("rechaz")
      ? "Cancelado"
      : ((o?.estado ?? o?.status ?? "") as UIEstado);

    if (!String(estadoMapped ?? "").trim()) {
      estadoMapped = "Pendiente";
    }

    const rawItems =
      (Array.isArray(o?.items) && o.items) ||
      (Array.isArray(o?.detalle) && o.detalle) ||
      (Array.isArray(o?.productos) && o.productos) ||
      (Array.isArray(o?.order_items) && o.order_items) ||
      [];

    const items: UIItem[] = rawItems.map((it: any) => {
      const productId =
        it?.producto_id ??
        it?.productoId ??
        it?.id_producto ??
        it?.product_id ??
        it?.productId ??
        it?.producto?.id ??
        it?.producto?.producto_id ??
        it?.product?.id ??
        it?.product?.product_id ??
        undefined;

      const productUniqueId =
        it?.idunico_producto ??
        it?.producto_idunico ??
        it?.id_unico_producto ??
        it?.producto?.idunico ??
        it?.product?.idunico ??
        null;

      const nombre =
        it?.nombre ??
        it?.producto_nombre ??
        it?.productoNombre ??
        it?.product_name ??
        it?.nombre_producto ??
        it?.descripcion ??
        it?.titulo ??
        it?.producto?.nombre ??
        it?.producto?.name ??
        it?.product?.nombre ??
        it?.product?.name ??
        undefined;

      const inlineImg =
        it?.imagen ??
        it?.url_imagen ??
        it?.image_url ??
        it?.imageUrl ??
        it?.foto ??
        it?.thumbnail ??
        it?.producto?.imagen ??
        it?.producto?.url_imagen ??
        it?.product?.image ??
        it?.product?.image_url ??
        undefined;

      const precio =
        it?.precio_venta != null
          ? Number(it.precio_venta)
          : it?.precio != null
          ? Number(it.precio)
          : it?.producto?.precio != null
          ? Number(it?.producto?.precio)
          : it?.product?.price != null
          ? Number(it?.product?.price)
          : undefined;

      const subtotal =
        it?.subtotal != null
          ? Number(it.subtotal)
          : it?.total_linea != null
          ? Number(it.total_linea)
          : undefined;

      const cantidad =
        Number(it?.cantidad ?? it?.qty ?? it?.quantity ?? 1) || 1;

      return {
        productId: productId ? String(productId) : undefined,
        productUniqueId: productUniqueId ? String(productUniqueId) : null,
        imageUrl: this.toStringUrl(inlineImg),
        nombre,
        cantidad,
        precio,
        subtotal,
      };
    });

    const itemsCount = items.reduce((acc, it) => acc + (it.cantidad || 1), 0);

    const clienteId =
      o?.cliente_id ??
      o?.clienteId ??
      o?.id_cliente ??
      o?.customer_id ??
      o?.usuario_id ??
      o?.cliente?.id ??
      "";

    const telefono =
      o?.numero_celular ??
      o?.telefono ??
      o?.celular ??
      o?.telefono_cliente ??
      o?.telefono_contacto ??
      o?.whatsapp ??
      o?.phone ??
      o?.phone_number ??
      o?.numero ??
      o?.cliente?.telefono ??
      o?.cliente?.celular ??
      "";

    const clienteNombre =
      o?.cliente_nombre ??
      o?.nombre_cliente ??
      (typeof o?.cliente === "string" ? o?.cliente : "") ??
      o?.cliente?.nombre ??
      o?.cliente?.name ??
      o?.customer?.name ??
      undefined;

    const clienteCorreo =
      o?.cliente_correo ??
      o?.correo_cliente ??
      o?.email ??
      o?.correo ??
      o?.cliente?.correo ??
      o?.cliente?.email ??
      undefined;

    const clienteDireccion =
      o?.cliente_direccion ??
      o?.direccion_cliente ??
      o?.direccion ??
      o?.address ??
      o?.cliente?.direccion ??
      o?.cliente?.address ??
      undefined;

    return {
      id: String(oid),
      estado: estadoMapped,
      fecha: d && !Number.isNaN(d.getTime()) ? d : null,
      total:
        o?.total != null && Number.isFinite(Number(o?.total))
          ? Number(o?.total)
          : null,
      items,
      itemsCount,
      cliente_id: clienteId ? String(clienteId) : "",
      numero_celular: telefono ? String(telefono) : "",
      cliente_nombre: clienteNombre,
      cliente_correo: clienteCorreo,
      cliente_direccion: clienteDireccion,
    };
  }

  pillClass() {
    const s = (this.order?.estado || "").toLowerCase();
    return {
      pill: true,
      "pill--pendiente": s.includes("pend"),
      "pill--confirmado": s.includes("conf"),
      "pill--entregado": s.includes("entre") || s.includes("entreg"),
      "pill--cancelado":
        s.includes("canc") || s.includes("anul") || s.includes("rechaz"),
    };
  }

  onImgError(it: UIItem) {
    it.imageUrl = undefined;
    this.cd.markForCheck();
  }

  openWhatsApp() {
    const tel = (this.order?.numero_celular || "").replace(/\D/g, "");
    if (!tel) return;
    window.open(`https://wa.me/${tel}`, "_blank");
  }

  goBack() {
    if (history.length > 1) this.nav.back();
    else this.nav.navigateBack(["/orders/order-management"]);
  }

  trackItem = (_: number, it: UIItem) => it.productId ?? it.nombre ?? _ + "";
}
