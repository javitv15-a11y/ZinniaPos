import { CommonModule } from "@angular/common";
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from "@angular/core";
import {
  IonicModule,
  AlertController,
  ActionSheetController,
  ToastController,
  NavController,
} from "@ionic/angular";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { Subscription } from "rxjs";
import {
  ProductService,
  ProductApi,
} from "src/app/core/services/bussiness/product.service";
import { FormsModule } from "@angular/forms";

type Status = "Activo" | "Inactivo";

interface UIInventoryDetail {
  id: string;
  name: string;
  status: Status;
  description?: string | null;
  categoryName?: string | null;
  images: string[];

  // inventario
  stockAvailable: number;
  stockReserved: number;
  stockOnHand: number;

  // opcional
  salePrice?: number | null;
  costPrice?: number | null;
  providerName?: string | null;
}

@Component({
  selector: "app-inventory-detail",
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule, FormsModule],
  templateUrl: "./inventory-detail.component.html",
  styleUrls: ["./inventory-detail.component.scss"],
})
export class InventoryDetailComponent implements OnInit, OnDestroy {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productsSrv: ProductService,
    private alertCtrl: AlertController,
    private actionSheet: ActionSheetController,
    private toast: ToastController,
    private nav: NavController
  ) {}

  @ViewChild("fileInput") fileInput!: ElementRef<HTMLInputElement>;

  loading = true;
  error?: string;

  /** Copia cruda para acceder a idunico si existe */
  private apiProduct?: ProductApi;

  /** UI data (null mientras carga) */
  item: UIInventoryDetail | null = null;

  selectedIndex = 0;
  get heroImage(): string {
    return this.item?.images?.[this.selectedIndex] ?? "";
  }

  private sub?: Subscription;

  // ===== Preferencias de stock mínimo (como en la captura) =====
  minStockAlert = true; // Toggle encendido
  minStock = 2; // “2” en la pastilla

  /** Tomamos id preferente para endpoints de stock (idunico si existe) */
  private get stockTargetId(): string {
    return (this.apiProduct?.idunico as any) || this.item?.id || "";
  }

  ngOnInit(): void {
    this.sub = this.route.paramMap.subscribe((pm) => {
      const id = pm.get("id");
      if (!id) {
        this.error = "Falta el id.";
        this.loading = false;
        return;
      }
      this.loadItem(id);
    });

    // TODO: si tienes endpoints para persistir minStock/minStockAlert, cárgalos aquí
    // this.productsSrv.getMinStock(this.stockTargetId).then(...)
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();

    // TODO: si quieres persistir al salir:
    // this.productsSrv.setMinStock(this.stockTargetId, { enabled: this.minStockAlert, value: this.minStock });
  }

  // ===== Helpers =====
  private toNum(v: any, fallback = 0): number {
    if (v === null || v === undefined || v === "") return fallback;
    if (typeof v === "number") return isFinite(v) ? v : fallback;
    const s = String(v).trim();
    const normalized =
      s.includes(",") && s.includes(".")
        ? s.replace(/\./g, "").replace(",", ".")
        : s.includes(",")
        ? s.replace(",", ".")
        : s;
    const n = parseFloat(normalized);
    return isFinite(n) ? n : fallback;
  }
  private truthy(v: any): boolean {
    const s = String(v ?? "").toLowerCase();
    return (
      v === true ||
      v === 1 ||
      s === "1" ||
      s === "true" ||
      s === "activo" ||
      s === "enabled"
    );
  }
  private statusToText(v: any): Status {
    return this.truthy(v) ? "Activo" : "Inactivo";
  }
  private first<T = any>(...vals: T[]): T | null {
    for (const v of vals)
      if (v !== undefined && v !== null && v !== "") return v;
    return null;
  }
  private collectImages(p: any): string[] {
    const arr =
      this.first<any[]>(
        Array.isArray(p?.imagenes) ? p.imagenes : null,
        Array.isArray(p?.images) ? p.images : null,
        Array.isArray(p?.fotos) ? p.fotos : null
      ) || [];
    const single = this.first<string>(
      p?.imagen,
      p?.image,
      p?.url_imagen,
      p?.urlImagen
    );
    const out: string[] = [];
    if (arr?.length) out.push(...arr.filter(Boolean));
    if (single) out.push(single);
    return out;
  }

  private mapToUI(p: ProductApi): UIInventoryDetail {
    const anyP: any = p;

    const stockActual = this.toNum(
      this.first(anyP.stock_actual, anyP.stock, anyP.existencias),
      0
    );
    const stockReservado = this.toNum(
      this.first(anyP.stock_reservado, anyP.reservado),
      0
    );
    const stockDisponible = this.toNum(
      this.first(anyP.stock_disponible),
      stockActual - stockReservado
    );
    const stockOnHand = this.toNum(
      this.first(anyP.stock_on_hand, anyP.existencias),
      stockDisponible + stockReservado
    );

    return {
      id: String(this.first(anyP.id, anyP._id, anyP.codigo, "")),
      name: String(this.first(anyP.nombre, anyP.name, "Producto")),
      status: this.statusToText(this.first(anyP.estado, anyP.status, true)),
      description: this.first(anyP.descripcion, anyP.description),
      categoryName: this.first(
        anyP.categoria_nombre,
        anyP.category_name,
        anyP.categoria?.nombre,
        anyP.categoria?.name,
        anyP.category?.nombre,
        anyP.category?.name
      ) as any,

      salePrice: this.toNum(
        this.first(anyP.precio_venta, anyP.precio, anyP.price),
        0
      ),
      costPrice: this.toNum(
        this.first(anyP.precio_costo, anyP.costo, anyP.cost),
        0
      ),
      providerName: this.first(
        anyP.proveedor_nombre,
        anyP.provider_name,
        anyP.proveedor?.nombre,
        anyP.proveedor?.name
      ) as string | null,

      stockAvailable: Math.max(0, stockDisponible),
      stockReserved: Math.max(0, stockReservado),
      stockOnHand: Math.max(0, stockOnHand),

      images: this.collectImages(anyP),
    };
  }

  // ===== Data =====
  async loadItem(id: string) {
    this.loading = true;
    this.error = undefined;

    try {
      // 1) Buscar el producto
      let api: ProductApi | undefined;
      try {
        api = await this.productsSrv.getById(id);
      } catch {}
      if (!api || !api.id) {
        const list = await this.productsSrv.getAll();
        api = list.find((x: any) => String(x.id) === String(id)) as any;
      }
      if (!api) throw new Error("No encontrado");

      // 2) Mapear a UI y mostrar de inmediato
      this.apiProduct = api;
      this.item = this.mapToUI(api);
      this.selectedIndex = 0;
      this.loading = false; // ✅ dejamos de mostrar skeleton aquí

      // 3) Galería en segundo plano (sin bloquear)
      try {
        const imgs = await this.productsSrv.getImages({
          id: api.id,
          idunico: api.idunico,
        });
        if (imgs?.length) {
          this.item!.images = imgs;
        } else {
          const cover = await this.productsSrv.getCoverUrl({
            id: api.id,
            idunico: api.idunico,
          });
          if (cover) this.item!.images = [cover];
        }
      } catch {
        // si falla la galería, no rompemos la vista
      }
    } catch (e: any) {
      this.error = e?.message || "No se pudo cargar el detalle";
      this.item = null;
      this.loading = false;
    }
  }

  reload() {
    if (this.item?.id) this.loadItem(this.item.id);
  }

  // ===== Acciones UI =====
  selectImage(i: number) {
    this.selectedIndex = i;
  }
  triggerUpload() {
    this.fileInput?.nativeElement?.click();
  }

  async handleUpload(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file || !this.item) return;
    try {
      const target = (this.apiProduct as any)?.idunico || this.item.id;
      const srv: any = this.productsSrv as any;
      if (typeof srv.uploadImages === "function") {
        await srv.uploadImages(target, [file]);
      } else {
        // último recurso: “simular” guardado
        const blobUrl = URL.createObjectURL(file);
        await this.productsSrv.update(this.item.id, { imagen: blobUrl } as any);
      }
      await this.presentToast("Imagen subida");
      await this.loadItem(this.item.id);
    } catch {
      await this.presentToast("No se pudo subir la imagen");
    } finally {
      (ev.target as HTMLInputElement).value = "";
    }
  }

  // inventory-detail.component.ts
  async viewHistory() {
    try {
      const id = this.item?.id;
      if (!id) {
        console.warn("[viewHistory] item.id no está disponible", this.item);
        await this.presentToast("No se encontró el ID del producto.");
        return;
      }

      const absolute = ["/inventory", id, "movements"];
      console.log("[viewHistory] navegando a", absolute.join("/"));

      // 1) intento: ruta absoluta
      const okAbs = await this.router.navigate(absolute).catch(() => false);
      if (okAbs) return;

      // 2) intento: relativo a la ruta actual (/inventory/:id)
      const okRel = await this.router
        .navigate(["../", id, "movements"], { relativeTo: this.route })
        .catch(() => false);
      if (okRel) return;

      // 3) intento: NavController de Ionic
      try {
        await this.nav.navigateForward(absolute);
        return;
      } catch {}

      await this.presentToast("No se pudo abrir el historial.");
    } catch (e) {
      console.error("[viewHistory] error", e);
      await this.presentToast("Error al abrir historial.");
    }
  }

  async addEntry() {
    if (!this.item) return;
    const alert = await this.alertCtrl.create({
      header: "Agregar entrada",
      inputs: [{ name: "qty", type: "number", placeholder: "Cantidad" }],
      buttons: [
        { text: "Cancelar", role: "cancel" },
        {
          text: "Agregar",
          handler: async ({ qty }) => {
            const n = this.toNum(qty, 0);
            if (n <= 0) return;
            try {
              const srv: any = this.productsSrv as any;

              if (typeof srv.addMovement === "function") {
                await srv.addMovement(this.stockTargetId, {
                  tipo: "entrada",
                  cantidad: n,
                });
              } else {
                const current = await this.productsSrv.getStock(
                  this.stockTargetId
                );
                const next = current + n;
                await this.productsSrv.setStock(this.stockTargetId, next);
              }

              await this.presentToast("Entrada registrada");
              await this.loadItem(this.item!.id);
            } catch {
              await this.presentToast("No se pudo registrar la entrada");
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async addExit() {
    if (!this.item) return;
    const alert = await this.alertCtrl.create({
      header: "Agregar salida",
      inputs: [{ name: "qty", type: "number", placeholder: "Cantidad" }],
      buttons: [
        { text: "Cancelar", role: "cancel" },
        {
          text: "Registrar",
          handler: async ({ qty }) => {
            const n = this.toNum(qty, 0);
            if (n <= 0) return;
            try {
              const srv: any = this.productsSrv as any;

              if (typeof srv.addMovement === "function") {
                await srv.addMovement(this.stockTargetId, {
                  tipo: "salida",
                  cantidad: n,
                });
              } else {
                const current = await this.productsSrv.getStock(
                  this.stockTargetId
                );
                const next = Math.max(0, current - n);
                await this.productsSrv.setStock(this.stockTargetId, next);
              }

              await this.presentToast("Salida registrada");
              await this.loadItem(this.item!.id);
            } catch {
              await this.presentToast("No se pudo registrar la salida");
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async openMore() {
    const sheet = await this.actionSheet.create({
      header: "Acciones",
      buttons: [
        {
          text: "Compartir",
          icon: "share-social-outline",
          handler: () => this.share(),
        },
        { text: "Cancelar", role: "cancel" },
      ],
    });
    await sheet.present();
  }

  async share() {
    await this.presentToast("Compartido (demo)");
  }

  private async presentToast(message: string) {
    const t = await this.toast.create({
      message,
      duration: 1500,
      position: "bottom",
    });
    await t.present();
  }
}
