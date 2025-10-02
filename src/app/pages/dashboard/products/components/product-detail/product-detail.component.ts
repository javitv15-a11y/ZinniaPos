// ===============================================
// src/app/pages/dashboard/products/components/product-detail/product-detail.component.ts
// ===============================================
import { CommonModule } from "@angular/common";
import {
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
  ElementRef,
} from "@angular/core";
import {
  IonicModule,
  AlertController,
  ActionSheetController,
  ToastController,
  ActionSheetButton,
} from "@ionic/angular";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { Subscription, firstValueFrom } from "rxjs";
import { FormsModule } from "@angular/forms";

import {
  ProductService,
  ProductApi,
} from "src/app/core/services/bussiness/product.service";
import { SupplierService } from "src/app/core/services/bussiness/supplier.service";
import {
  ProductCategoryService,
  CategoriaApi,
} from "src/app/core/services/bussiness/product-category.service";

type Status = "Activo" | "Inactivo";

interface UIProductDetail {
  id: string;
  name: string;
  status: Status;
  description?: string | null;
  salePrice: number;
  costPrice: number;
  providerName?: string | null;
  categoryName?: string | null;
  stockActual: number;
  stockMin: number;
  images: string[];
}

@Component({
  selector: "app-product-detail",
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule, FormsModule],
  templateUrl: "./product-detail.component.html",
  styleUrls: ["./product-detail.component.scss"],
})
export class ProductDetailComponent implements OnInit, OnDestroy {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productsSrv: ProductService,
    private alertCtrl: AlertController,
    private actionSheet: ActionSheetController,
    private toastCtrl: ToastController,
    private supplierSrv: SupplierService,
    private categorySrv: ProductCategoryService // 👈 NUEVO
  ) {}

  @ViewChild("fileInput") fileInput!: ElementRef<HTMLInputElement>;

  loading = true;
  error?: string;

  private apiProduct?: ProductApi;
  product?: UIProductDetail;

  selectedIndex = 0;
  get heroImage(): string | null {
    return this.product?.images?.[this.selectedIndex] ?? null;
  }

  private sub?: Subscription;

  editOpen = false;
  edit: any = {
    nombre: "",
    descripcion: "",
    precio_venta: "",
    precio_costo: "",
    stock: "",
    categoria_id: "",
    proveedor_id: "",
    categoria_nombre: "",
    proveedor_nombre: "",
    impuesto: "",
  };

  // caches
  private categoriesCache: Array<{ id: string; nombre: string }> | null = null;
  private suppliersCache: Array<{ id: string; nombre: string }> | null = null;

  ngOnInit(): void {
    this.sub = this.route.paramMap.subscribe((pm) => {
      const id = pm.get("id");
      if (!id) {
        this.error = "Falta el id de producto.";
        this.loading = false;
        return;
      }
      this.loadProduct(id);
    });
  }
  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private toNumber(v: any): number {
    if (v === null || v === undefined || v === "") return 0;
    if (typeof v === "number") return isFinite(v) ? v : 0;
    const s = String(v).trim();
    const hasComma = s.includes(","), hasDot = s.includes(".");
    let normalized = s;
    if (hasComma && hasDot) normalized = s.replace(/\./g, "").replace(",", ".");
    else if (hasComma) normalized = s.replace(",", ".");
    const n = parseFloat(normalized);
    return isFinite(n) ? n : 0;
  }
  private statusToText(v: any): Status {
    const k = String(v ?? "").toLowerCase();
    if (v === true || v === 1 || k === "1" || k === "true" || k.includes("activo") || k === "active")
      return "Activo";
    if (v === false || v === 0 || k === "0" || k === "false" || k.includes("inactivo") || k === "inactive")
      return "Inactivo";
    return "Activo";
  }
  private firstNonEmpty<T = any>(...vals: T[]): T | null {
    for (const v of vals) if (v !== undefined && v !== null && v !== "") return v;
    return null;
  }
  private collectImages(p: any): string[] {
    const arr =
      this.firstNonEmpty<any[]>(
        Array.isArray(p?.imagenes) ? p.imagenes : null,
        Array.isArray(p?.images) ? p.images : null,
        Array.isArray(p?.fotos) ? p.fotos : null
      ) || [];
    const single = this.firstNonEmpty<string>(p?.imagen, p?.image, p?.url_imagen, p?.urlImagen);
    const out: string[] = [];
    if (arr?.length) out.push(...arr.filter(Boolean));
    if (single) out.push(single);
    return out;
  }

  private mapToUI(p: ProductApi): UIProductDetail {
    const anyP: any = p;
    const name = this.firstNonEmpty(anyP.nombre, anyP.name, anyP.titulo, anyP.title, "Producto") as string;
    const description = this.firstNonEmpty(anyP.descripcion, anyP.description, anyP.detalle, anyP.observaciones) as string | null;
    const salePrice = this.toNumber(this.firstNonEmpty(anyP.precio_venta, anyP.precioVenta, anyP.precio, anyP.price, anyP.pvp, 0));
    const costPrice  = this.toNumber(this.firstNonEmpty(anyP.precio_costo, anyP.precioCosto, anyP.costo, anyP.cost, 0));
    const stockActual = this.toNumber(this.firstNonEmpty(anyP.stock_actual, anyP.stock, anyP.existencias, anyP.cantidad, 0));
    const stockMin    = this.toNumber(this.firstNonEmpty(anyP.stock_minimo, anyP.stockMin, anyP.stock_min, 0));
    const providerName = this.firstNonEmpty(
      anyP.proveedor_nombre, anyP.provider_name,
      anyP.proveedor?.nombre, anyP.proveedor?.name,
      anyP.provider?.nombre, anyP.provider?.name
    ) as string | null;
    const categoryName = this.firstNonEmpty(
      anyP.categoria_nombre, anyP.category_name,
      anyP.categoria?.nombre, anyP.categoria?.name,
      anyP.category?.nombre, anyP.category?.name
    ) as string | null;

    return {
      id: String(anyP.id ?? anyP._id ?? anyP.codigo ?? ""),
      name,
      status: this.statusToText(this.firstNonEmpty(anyP.estado, anyP.status, anyP.activo, true)),
      description,
      salePrice,
      costPrice,
      providerName,
      categoryName,
      stockActual,
      stockMin,
      images: this.collectImages(anyP),
    };
  }

  async loadProduct(id: string) {
    this.loading = true;
    this.error = undefined;
    try {
      let apiProduct: ProductApi | undefined;
      try {
        apiProduct = await this.productsSrv.getById(id);
      } catch {}

      if (!apiProduct || !apiProduct.id) {
        const list = await this.productsSrv.getAll();
        apiProduct = list.find((x: any) => String(x.id) === String(id)) as any;
      }
      if (!apiProduct) throw new Error("Producto no encontrado");

      this.apiProduct = apiProduct;
      this.product = this.mapToUI(apiProduct);
      this.selectedIndex = 0;

      const imgs = await this.productsSrv.getImages({ id: apiProduct.id, idunico: apiProduct.idunico });
      if (imgs?.length) this.product.images = imgs;
      else {
        const cover = await this.productsSrv.getCoverUrl({ id: apiProduct.id, idunico: apiProduct.idunico });
        if (cover) this.product.images = [cover];
      }

      await this.ensureCategoryName();
      await this.ensureProviderName();
    } catch (e: any) {
      this.error = e?.message || "No se pudo cargar el producto";
      this.product = undefined;
    } finally {
      this.loading = false;
    }
  }

  // ====== Categoría / Proveedor ======
  private async ensureCategoryName() {
    if (!this.product) return;
    if (this.product.categoryName) return;
    const catId = (this.apiProduct as any)?.categoria_id;
    if (!catId) return;

    const categorias = await this.getCategoriesFromService();
    const match = categorias.find((c) => String(c.id) === String(catId));
    if (match) this.product.categoryName = match.nombre;
  }

  private async ensureProviderName() {
    if (!this.product) return;
    if (this.product.providerName) return;

    const provId = (this.apiProduct as any)?.proveedor_id;
    if (!provId) return;

    const proveedores = await this.getSuppliersFromApi();
    const match = proveedores.find((p) => String(p.id) === String(provId));
    if (match) this.product.providerName = match.nombre;
  }

  private async getCategoriesFromService(): Promise<Array<{ id: string; nombre: string }>> {
    if (this.categoriesCache) return this.categoriesCache;
    try {
      const arr = await this.categorySrv.getCategorias();
      this.categoriesCache = (arr || []).map((c: CategoriaApi) => ({
        id: String(c.id),
        nombre: String(c.nombre || c.id),
      })).sort((a, b) => a.nombre.localeCompare(b.nombre));
      return this.categoriesCache;
    } catch {
      this.categoriesCache = [];
      return [];
    }
  }

  private async getSuppliersFromApi(): Promise<Array<{ id: string; nombre: string }>> {
    if (this.suppliersCache) return this.suppliersCache;
    try {
      const obs: any = (this.supplierSrv as any).getAllSuppliers
        ? (this.supplierSrv as any).getAllSuppliers("")
        : (this.supplierSrv as any).list?.();
      const arr: any[] = await firstValueFrom(obs);
      this.suppliersCache = (arr || []).map((raw: any) => {
        const id = String(raw?.id ?? raw?.proveedor_id ?? raw?._id ?? "").trim();
        const nombre = String(raw?.nombre ?? raw?.name ?? "").trim() || `Proveedor ${id}`;
        return id ? { id, nombre } : null;
      }).filter(Boolean) as Array<{ id: string; nombre: string }>;
      this.suppliersCache.sort((a, b) => a.nombre.localeCompare(b.nombre));
      return this.suppliersCache;
    } catch {
      this.suppliersCache = [];
      return [];
    }
  }

  // ====== UI ======
  reload() { if (this.product?.id) this.loadProduct(this.product.id); }
  selectImage(i: number) { this.selectedIndex = i; }
  triggerUpload() { this.fileInput?.nativeElement?.click(); }

  async handleUpload(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file || !this.product) return;

    const blobUrl = URL.createObjectURL(file);
    const alert = await this.alertCtrl.create({
      header: "Subir imagen",
      message: `<div style="display:flex;justify-content:center;"><img src="${blobUrl}" style="max-width:220px;border-radius:8px"/></div>¿Deseas subir esta imagen?`,
      buttons: [
        { text: "Cancelar", role: "cancel", handler: () => URL.revokeObjectURL(blobUrl) },
        {
          text: "Subir",
          handler: async () => {
            try {
              const target = (this.apiProduct as any)?.idunico || this.product!.id;
              await this.productsSrv.uploadImages(target, [file]);
              this.productsSrv.notifyProductChanged(this.product!.id, "image_uploaded");
              await this.presentToast("Imagen subida");
              await this.loadProduct(this.product!.id);
            } catch {
              await this.presentToast("No se pudo subir la imagen");
            } finally {
              URL.revokeObjectURL(blobUrl);
            }
          },
        },
      ],
    });
    await alert.present();
    (ev.target as HTMLInputElement).value = "";
  }

  async confirmDeleteImage(imgUrl: string) {
    const alert = await this.alertCtrl.create({
      header: "Eliminar imagen",
      message: `<div style="display:flex;justify-content:center;"><img src="${imgUrl}" style="max-width:220px;border-radius:8px"/></div>¿Deseas eliminar esta imagen?`,
      buttons: [
        { text: "Cancelar", role: "cancel" },
        { text: "Eliminar", role: "destructive", handler: () => this.deleteImage(imgUrl) },
      ],
    });
    await alert.present();
  }

  private async deleteImage(imgUrl: string) {
    if (!this.product) return;
    try {
      const ok = await this.productsSrv.deleteImage({ idunico: this.apiProduct?.idunico, id: this.product.id }, imgUrl);
      await this.presentToast(ok ? "Imagen eliminada" : "No se pudo eliminar");
      if (ok) {
        this.productsSrv.notifyProductChanged(this.product.id, "image_deleted");
        this.loadProduct(this.product.id);
      }
    } catch (e: any) {
      await this.presentToast(e?.message || "No se pudo eliminar");
    }
  }

  async editInventory() {
    if (!this.product) return;
    const alert = await this.alertCtrl.create({
      header: "Actualizar stock",
      inputs: [{ name: "stock", type: "number", value: String(this.product.stockActual), placeholder: "Stock" }],
      buttons: [
        { text: "Cancelar", role: "cancel" },
        {
          text: "Guardar",
          handler: async (data) => {
            const n = this.toNumber(data.stock);
            try {
              await this.productsSrv.updateStock(this.product!.id, n);
              this.productsSrv.notifyProductChanged(this.product!.id, "stock_updated", { stock: n });
              await this.presentToast("Stock actualizado");
              await this.loadProduct(this.product!.id);
            } catch (e: any) {
              await this.presentToast(e?.message || "No se pudo actualizar");
            }
          },
        },
      ],
    });
    await alert.present();
  }

  openEdit() {
    if (!this.product || !this.apiProduct) return;
    this.edit = {
      nombre: this.product.name,
      descripcion: this.product.description ?? "",
      precio_venta: String(this.product.salePrice),
      precio_costo: String(this.product.costPrice),
      stock: String(this.product.stockActual),
      categoria_id: String(this.apiProduct.categoria_id || ""),
      proveedor_id: String(this.apiProduct.proveedor_id || ""),
      categoria_nombre: this.product.categoryName || "",
      proveedor_nombre: this.product.providerName || "",
      impuesto: String(this.apiProduct.impuesto ?? 18),
    };
    this.editOpen = true;
  }

  closeEdit() { this.editOpen = false; }

  async saveEdit() {
    if (!this.product || !this.apiProduct) return;
    const id = String(this.apiProduct.id);

    const toMoneyStr = (v: any): string => {
      if (v === null || v === undefined || v === "") return "0.00";
      const s = String(v).trim();
      const hasComma = s.includes(","), hasDot = s.includes(".");
      let nStr = s;
      if (hasComma && hasDot) nStr = s.replace(/\./g, "").replace(",", ".");
      else if (hasComma) nStr = s.replace(",", ".");
      const n = parseFloat(nStr);
      return isFinite(n) ? n.toFixed(2) : "0.00";
    };
    const toIntStr = (v: any): string => {
      if (v === null || v === undefined || v === "") return "0";
      const n = Math.trunc(Number(String(v).replace(/[^\d.-]/g, "")));
      return isFinite(n) ? String(n) : "0";
    };

    const imagenes = (this.product?.images ?? []).map((url) => ({ filename: this.filenameFromUrl(url), url }));
    const portada = this.heroImage || this.product?.images?.[0] || "";

    const payload: Record<string, any> = {
      id,
      idunico: this.apiProduct!.idunico ?? undefined,
      nombre: String(this.edit.nombre ?? "").trim(),
      descripcion: String(this.edit.descripcion ?? "").trim(),
      precio_costo: toMoneyStr(this.edit.precio_costo),
      precio_venta: toMoneyStr(this.edit.precio_venta),
      stock: toIntStr(this.edit.stock),
      categoria_id: String(this.edit.categoria_id ?? this.apiProduct!.categoria_id ?? ""),
      proveedor_id: String(this.edit.proveedor_id ?? this.apiProduct!.proveedor_id ?? ""),
      impuesto: toMoneyStr(this.edit.impuesto ?? this.apiProduct!.impuesto ?? 0),
      imagenes,
      imagen_portada_url: portada,
    };

    Object.keys(payload).forEach((k) => {
      const v = payload[k];
      if (v === "" || v === null || v === undefined) delete payload[k];
    });

    try {
      await this.productsSrv.update(id, payload);
      this.productsSrv.notifyProductChanged(id, "updated", { payload });
      await this.presentToast("Producto actualizado");
      this.closeEdit();
      await this.loadProduct(id);
    } catch (e: any) {
      await this.presentToast(e?.message || "No se pudo actualizar el producto");
    }
  }

  async chooseCategory() {
    const opciones = await this.getCategoriesFromService();
    const buttons: ActionSheetButton[] = opciones.map((o) => ({
      text: o.nombre,
      handler: () => {
        this.edit.categoria_id = o.id;
        this.edit.categoria_nombre = o.nombre;
      },
    }));
    buttons.push({ text: "Cancelar", role: "cancel" });
    const sheet = await this.actionSheet.create({ header: "Seleccionar categoría", buttons });
    await sheet.present();
  }

  async chooseProvider() {
    const opciones = await this.getSuppliersFromApi();
    if (!opciones.length) {
      await this.presentToast("No hay proveedores disponibles");
      return;
    }
    const buttons: ActionSheetButton[] = opciones.map((o) => ({
      text: o.nombre,
      handler: () => {
        this.edit.proveedor_id = o.id;
        this.edit.proveedor_nombre = o.nombre;
      },
    }));
    buttons.push({ text: "Cancelar", role: "cancel" });
    const sheet = await this.actionSheet.create({ header: "Seleccionar proveedor", buttons });
    await sheet.present();
  }

  private filenameFromUrl(url: string): string {
    try { return String(url).split("?")[0].split("/").pop() || String(url); }
    catch { return String(url); }
  }

  async openMore() {
    const sheet = await this.actionSheet.create({
      header: "Acciones",
      buttons: [
        { text: "Editar", icon: "create-outline", handler: () => this.openEdit() },
        { text: "Compartir", icon: "share-social-outline", handler: () => this.share() },
        { text: "Cancelar", role: "cancel" },
      ],
    });
    await sheet.present();
  }

  async share() { await this.presentToast("Compartido (demo)"); }

  private async presentToast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 1600, position: "bottom" });
    await t.present();
  }
}
