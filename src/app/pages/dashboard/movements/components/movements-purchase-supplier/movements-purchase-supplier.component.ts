import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit, inject } from "@angular/core";
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import {
  IonicModule,
  ActionSheetController,
  LoadingController,
} from "@ionic/angular";
import { ModalController } from "@ionic/angular/standalone";
import { firstValueFrom, Subject } from "rxjs";

import { DirectivesModule } from "src/app/core/directives/directives.module";
import { HeaderComponent } from "src/app/shared/components/header/header.component";
import { AddDiscountToOrderComponent } from "src/app/pages/dashboard/orders/components/add-discount-to-order/add-discount-to-order.component";

import { DiscountTypeValues } from "src/app/core/consts/enums/business/discount.enum";
import { IDiscount } from "src/app/core/interfaces/bussiness/discount.interface";
import { IProduct } from "src/app/core/interfaces/bussiness/product.interface";
import { IUser } from "src/app/core/interfaces/bussiness/user.interface";
import { settingHeader } from "./movements-purchase-supplier";
import { ToastService } from "src/app/core/services/utils/toast.service";
import { LoadingService } from "src/app/core/services/utils/loading.service";
import { AuthSessionService } from "src/app/core/services/utils/auth-session.service";
import { ProductService } from "src/app/core/services/bussiness/product.service";
import { SupplierService } from "src/app/core/services/bussiness/supplier.service";

import { addIcons } from "ionicons";
import {
  addOutline,
  closeOutline,
  removeOutline,
  trashOutline,
  chevronDownOutline,
  checkmarkOutline,
} from "ionicons/icons";
import { MovementsPaymentMethodComponent } from "../movements-payment-method/movements-payment-method.component";

/* ===== Tipos locales ===== */
export interface ISupplier {
  id: string | number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}
export interface IPurchaseItem {
  id: string;
  product: IProduct & { purchasePrice: number; salePrice?: number };
  quantity: number;
}
export type CreateEntradaDto = {
  proveedor_id: string | number;
  items: { producto_id: number; cantidad: number; costo_unitario: number }[];
  descuento: number;
  impuesto_estimado: number;
  subtotal: number;
  total: number;
  metodo_pago?: string;
};

@Component({
  selector: "app-movements-purchase-supplier",
  templateUrl: "./movements-purchase-supplier.component.html",
  styleUrls: ["./movements-purchase-supplier.component.scss"],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    HeaderComponent,
    DirectivesModule,
    ReactiveFormsModule,
    FormsModule,
  ],
})
export class MovementsPurchaseSupplierComponent implements OnInit, OnDestroy {
  /* Services */
  private fb = inject(FormBuilder);
  public modalCtrl = inject(ModalController);
  private toast = inject(ToastService);
  private loading = inject(LoadingService);
  private ionicLoading = inject(LoadingController);
  private auth = inject(AuthSessionService);
  private productsSrv = inject(ProductService);
  private suppliersSrv = inject(SupplierService);
  private actionSheet = inject(ActionSheetController);
  public settingHeader = settingHeader;

  /* Forms */
  public supplierForm!: FormGroup;
  public productsForm!: FormGroup;

  /* Estado */
  public suppliers: ISupplier[] = [];
  public filteredSuppliers: ISupplier[] = [];
  public products: (IProduct & {
    purchasePrice: number;
    salePrice?: number;
  })[] = [];
  public filteredProducts: (IProduct & {
    purchasePrice: number;
    salePrice?: number;
  })[] = [];

  public selectedSupplier?: ISupplier;
  public items: IPurchaseItem[] = [];

  public supplierModalOpen = false;
  public productModalOpen = false;
  private selectedProductIds = new Set<string | number>();

  /* Totales */
  public subtotal = 0;
  public discount!: IDiscount;
  public estimatedTax = 0;
  public total = 0;

  /* Pago */
  public paymentMethod?: "cash" | "transfer" | "card" | "other";
  public paymentMethodLabel = "";
  private paymentMethods = [
    { key: "cash", label: "Efectivo" },
    { key: "transfer", label: "Transferencia" },
    { key: "card", label: "Tarjeta" },
    { key: "other", label: "Otro" },
  ];

  /* Misc */
  private loggedUser: IUser | null = null;
  private destroy$ = new Subject<void>();
  private coverCache = new Map<string, string | null>();

  /* ===== Ciclo de vida ===== */
  ngOnInit(): void {
    addIcons({
      addOutline,
      closeOutline,
      removeOutline,
      trashOutline,
      chevronDownOutline,
      checkmarkOutline,
    });
    this.buildForms();
    this.loggedUser = this.auth.getCurrentUser();
    this.loadLookupsFromDB();
  }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ===== Forms ===== */
  private buildForms() {
    this.supplierForm = this.fb.group({ supplier: ["", Validators.required] });
    this.productsForm = this.fb.group({ products: this.fb.array([]) });
  }

  /* ===== Helpers ===== */
  private toNumberPrice(v: any): number {
    if (v == null) return 0;
    if (typeof v === "number") return isFinite(v) ? v : 0;
    if (typeof v === "string") {
      const s = v.trim();
      if (s.includes(",") && /,\d{1,2}$/.test(s)) {
        const n = Number(
          s
            .replace(/\./g, "")
            .replace(",", ".")
            .replace(/[^\d.]/g, "")
        );
        return isFinite(n) ? n : 0;
      }
      const n = Number(s.replace(/[^0-9.]/g, ""));
      return isFinite(n) ? n : 0;
    }
    const n = Number(v);
    return isFinite(n) ? n : 0;
  }
  private normalizeText(v = ""): string {
    return v
      .toString()
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }
  private filterList<T>(
    items: T[],
    term: string,
    pickers: Array<(x: T) => string>
  ): T[] {
    const t = this.normalizeText(term || "");
    if (!t) return [...items];
    return items.filter((it) =>
      pickers.some((p) => this.normalizeText(p(it) || "").includes(t))
    );
  }
  public getImageSrc(product: IProduct): string {
    const id = String((product as any).id ?? "");
    const cached = this.coverCache.get(id) || null;
    const fromImages = (product as any).images?.[0] ?? null;
    return fromImages || cached || "assets/icon/default-product.svg";
  }

  /* ===== Proveedores ===== */
  private mapSupplier = (s: any): ISupplier | null => {
    const id = String(s?.id ?? s?.proveedor_id ?? s?._id ?? "").trim();
    const name =
      String(s?.name ?? s?.nombre ?? "").trim() ||
      (id ? `Proveedor ${id}` : "");
    if (!id) return null;
    return {
      id,
      name,
      email: s?.email ?? s?.correo ?? "",
      phone: s?.phone ?? s?.telefono ?? "",
      address: s?.address ?? s?.direccion ?? "",
    };
  };
  private async fetchSuppliers(): Promise<ISupplier[]> {
    try {
      const obs: any = (this.suppliersSrv as any).getAllSuppliers
        ? (this.suppliersSrv as any).getAllSuppliers("")
        : (this.suppliersSrv as any).list?.();
      const raw: any[] = obs ? await firstValueFrom(obs) : [];
      return (raw || []).map(this.mapSupplier).filter(Boolean) as ISupplier[];
    } catch {
      return [];
    }
  }
  public removeSelectedSupplier() {
    this.selectedSupplier = undefined;
  }
  public onSupplierSearch(ev: any) {
    const term = ev?.detail?.value ?? "";
    this.filteredSuppliers = this.filterList(this.suppliers, term, [
      (s) => s.name,
      (s) => s.email || "",
      (s) => s.phone || "",
    ]);
  }
  public selectSupplier(s: ISupplier) {
    this.selectedSupplier = s;
    this.supplierModalOpen = false;
  }

  /* ===== Productos ===== */
  private normalizeProductsPrices(): void {
    this.products = (this.products ?? []).map((p: any) => {
      const purchasePrice = this.toNumberPrice(
        p.costo ?? p.costPrice ?? p.purchasePrice ?? p.price ?? p.salePrice
      );
      const salePrice = this.toNumberPrice(
        p.salePrice ?? p.precio_venta ?? p.price
      );
      return {
        ...p,
        name: p.name ?? p.nombre ?? "",
        purchasePrice,
        salePrice,
      } as IProduct & { purchasePrice: number; salePrice?: number };
    });
  }
  private async fetchProducts(): Promise<IProduct[]> {
    try {
      if ((this.productsSrv as any).getAllProducts) {
        const list = await firstValueFrom(this.productsSrv.getAllProducts());
        if (Array.isArray(list)) return list;
      }
    } catch {}
    try {
      const raw: any[] = await this.productsSrv.getAll();
      return (Array.isArray(raw) ? raw : []).map(this.productsSrv.toIProduct);
    } catch {
      return [];
    }
  }
  private async hydrateProductCovers(products: IProduct[]) {
    let all: any[] = [];
    try {
      all = await this.productsSrv.getAll();
    } catch {}
    const byId = new Map(all.map((a) => [String(a.id), a]));
    await Promise.allSettled(
      products.map(async (row: any) => {
        const id = String(row.id);
        if (this.coverCache.has(id)) {
          const cached = this.coverCache.get(id)!;
          if (cached)
            row.images = Array.isArray(row.images)
              ? [cached, ...row.images]
              : [cached];
          return;
        }
        const api = byId.get(id);
        let url: string | null = null;
        try {
          url = api?.idunico
            ? await this.productsSrv.getCoverUrl({ id, idunico: api.idunico })
            : await this.productsSrv.getCoverUrl(id);
        } catch {
          url = null;
        }
        this.coverCache.set(id, url);
        if (url)
          row.images = Array.isArray(row.images) ? [url, ...row.images] : [url];
      })
    );
  }
  public openProductsModal() {
    this.selectedProductIds = new Set(
      this.items.map((it) => (it.product as any).id)
    );
    this.filteredProducts = [...this.products];
    this.productModalOpen = true;
  }
  public onProductSearch(ev: any) {
    const term = ev?.detail?.value ?? "";
    this.filteredProducts = this.filterList(this.products, term, [
      (p: any) => p.name,
      (p: any) => p.sku || p.codigo || "",
    ]);
  }
  public isProductSelected(id: string | number | null | undefined): boolean {
    if (id === null || id === undefined) return false;
    return this.selectedProductIds.has(id);
  }
  public toggleProductSelection(p: IProduct & { purchasePrice: number }) {
    const id = (p as any).id ?? p.id;
    this.selectedProductIds.has(id)
      ? this.selectedProductIds.delete(id)
      : this.selectedProductIds.add(id);
  }
  public confirmProducts() {
    const ids = new Set(Array.from(this.selectedProductIds).map(String));
    const merged = new Map<string, IPurchaseItem>();
    this.items.forEach((it) => merged.set(String((it.product as any).id), it));
    this.products.forEach((p: any) => {
      const pid = String(p.id);
      if (!ids.has(pid) || merged.has(pid)) return;
      merged.set(pid, { id: cryptoRandomId(), product: p, quantity: 1 });
    });
    this.items = Array.from(merged.values());
    this.productModalOpen = false;
    this.updateTotals();
  }
  public removeItem(itemId: string) {
    this.items = this.items.filter((i) => i.id !== itemId);
    this.updateTotals();
  }
  public increaseQuantity(item: IPurchaseItem) {
    item.quantity++;
    this.updateTotals();
  }
  public decreaseQuantity(item: IPurchaseItem) {
    if (item.quantity > 1) {
      item.quantity--;
      this.updateTotals();
    }
  }

  /* Entradas en inputs */
  public onCostInput(item: IPurchaseItem, ev: any) {
    const v = this.toNumberPrice(ev?.detail?.value ?? ev?.target?.value);
    item.product.purchasePrice = v;
    this.updateTotals();
  }
  public onSaleInput(item: IPurchaseItem, ev: any) {
    const v = this.toNumberPrice(ev?.detail?.value ?? ev?.target?.value);
    (item.product as any).salePrice = v;
    // no afecta al total de la compra, así que no recalculamos si no quieres
  }

  /* ===== Totales / Descuento ===== */
  get discountValue(): number {
    if (!this.discount) return 0;
    const v = this.discount.value || 0;
    return this.discount.type === DiscountTypeValues.AMOUNT
      ? v
      : this.subtotal * (v / 100);
  }
  public updateTotals() {
    this.subtotal = this.items.reduce(
      (sum, it) => sum + it.product.purchasePrice * it.quantity,
      0
    );
    const d =
      this.discount?.type === DiscountTypeValues.PERCENTAGE
        ? this.subtotal * ((this.discount.value || 0) / 100)
        : this.discount?.type === DiscountTypeValues.AMOUNT
        ? this.discount.value || 0
        : 0;
    this.total = this.subtotal - d + this.estimatedTax;
  }
  public async addDiscount() {
    const modal = await this.modalCtrl.create({
      component: AddDiscountToOrderComponent,
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    if (data) {
      this.discount = data;
      this.updateTotals();
    }
  }

  async openPaymentMethodSheet() {
    if (this.items.length === 0 || this.total <= 0) return;

    console.log("[openPaymentMethodSheet] total =", this.total); // ayuda a verificar

    const modal = await this.modalCtrl.create({
      component: MovementsPaymentMethodComponent,
      breakpoints: [0, 0.5, 0.95],
      initialBreakpoint: 0.95,
      cssClass: "quick-sheet",
      componentProps: {
        totalAmount: this.total, // 👈 total real
        currencyCode: "USD", // 👈 fuerza USD
        initial: {
          paymentType: this.paymentMethod === "cash" ? "contado" : "credito",
          installments: 3,
          frequency: "semanal",
          startDate: new Date().toISOString(),
        },
      },
    });

    await modal.present();
    const { data, role } = await modal.onWillDismiss();
    if (role === "saved" && data) {
      this.paymentMethod = data.paymentType === "contado" ? "cash" : "transfer";
      this.paymentMethodLabel =
        data.paymentType === "contado" ? "Pago de contado" : "Pago a crédito";
    }
  }

  /* ===== Confirmación (solo UI) ===== */
  public isInvalid(): boolean {
    return (
      !this.selectedSupplier || this.items.length === 0 || !this.paymentMethod
    );
  }
  private buildCreatePayload(): CreateEntradaDto {
    return {
      proveedor_id: this.selectedSupplier?.id as any,
      items: this.items.map((it) => ({
        producto_id: Number((it.product as any).id),
        cantidad: Number(it.quantity),
        costo_unitario: Number(it.product.purchasePrice),
      })),
      descuento: this.discountValue,
      impuesto_estimado: this.estimatedTax,
      subtotal: this.subtotal,
      total: this.total,
      metodo_pago: this.paymentMethod,
    };
  }
  public async confirmEntry() {
    if (this.isInvalid()) {
      this.toast.showToast({
        message: "Completa proveedor, productos y método de pago.",
        color: "warning",
      });
      return;
    }
    const payload = this.buildCreatePayload();
    console.log("[Mock createEntrada] payload:", payload);

    await this.loading.showLoading("Creando entrada de compra...");
    await new Promise((r) => setTimeout(r, 500));
    await this.loading.hideLoading();

    // asegurar que no quede un ion-loading colgado
    setTimeout(async () => {
      const top = await this.ionicLoading.getTop();
      if (top)
        try {
          await top.dismiss();
        } catch {}
    }, 0);

    this.toast.showToast({
      message: "Entrada creada (solo UI)",
      color: "success",
    });
    this.actionCompleted();
  }
  public actionCompleted() {
    this.modalCtrl.dismiss({ completed: true });
  }

  /* ===== Carga de catálogos ===== */
  private async loadLookupsFromDB(): Promise<void> {
    await this.loading.showLoading("Cargando catálogo...");
    try {
      // Proveedores
      this.suppliers = await this.fetchSuppliers();
      this.filteredSuppliers = [...this.suppliers];

      // Productos
      const prods = await this.fetchProducts();
      this.products = prods as any;
      this.normalizeProductsPrices();
      this.filteredProducts = [...this.products];

      // Portadas
      await this.hydrateProductCovers(this.products as any);
    } catch (err) {
      console.error(err);
      this.toast.showToast({
        message: "No se pudo cargar proveedores/productos.",
        color: "danger",
      });
    } finally {
      try {
        await this.loading.hideLoading();
      } catch {}
      setTimeout(async () => {
        const top = await this.ionicLoading.getTop();
        if (top)
          try {
            await top.dismiss();
          } catch {}
      }, 0);
    }
  }

  /* Utils */
  trackByItemId = (_: number, it: IPurchaseItem) => it.id;
}

function cryptoRandomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
