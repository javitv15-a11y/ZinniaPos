import { CommonModule } from "@angular/common";
import { Component, OnInit, OnDestroy, inject } from "@angular/core";
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { IonicModule } from "@ionic/angular";
import { ModalController } from "@ionic/angular/standalone";
import { firstValueFrom, Subject } from "rxjs";

import { DirectivesModule } from "src/app/core/directives/directives.module";
import { CustomInputComponent } from "src/app/shared/components/custom-input/custom-input.component";
import { HeaderComponent } from "src/app/shared/components/header/header.component";

import {
  invalidFormMessage,
  mapProductToOrderItem,
  settingHeader,
  orderCreationMessages,
  waitingMessageCreatingOrder,
} from "./create-order.consts";

import { ICustomer } from "src/app/core/interfaces/bussiness/customers.interface";
import { IProduct } from "src/app/core/interfaces/bussiness/product.interface";
import {
  IOrderItem,
  IOrderPayload,
} from "src/app/core/interfaces/bussiness/order.interface";
import { IDiscount } from "src/app/core/interfaces/bussiness/discount.interface";

import { AddDiscountToOrderComponent } from "../add-discount-to-order/add-discount-to-order.component";
import { DiscountTypeValues } from "src/app/core/consts/enums/business/discount.enum";
import {
  OriginOfOrder,
  OrderStatusValue,
} from "src/app/core/consts/enums/business/order.enum";

import {
  ClientesService,
  ClienteApi,
} from "src/app/core/services/bussiness/clientes.service";
import { ProductService } from "src/app/core/services/bussiness/product.service";
import {
  OrderService,
  CreatePedidoDto,
} from "src/app/core/services/bussiness/order.service";
import { AuthSessionService } from "src/app/core/services/utils/auth-session.service";
import { ToastService } from "src/app/core/services/utils/toast.service";
import { LoadingService } from "src/app/core/services/utils/loading.service";

import { addIcons } from "ionicons";
import {
  addOutline,
  closeOutline,
  removeOutline,
  trashOutline,
  chevronDownOutline,
  checkmarkOutline,
} from "ionicons/icons";
import { IUser } from "src/app/core/interfaces/bussiness/user.interface";

@Component({
  selector: "app-create-order",
  templateUrl: "./create-order.component.html",
  styleUrls: ["./create-order.component.scss"],
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
export class CreateOrderComponent implements OnInit, OnDestroy {
 
  public _modalCtrl = inject(ModalController);
  private _formBuilder = inject(FormBuilder);
  private _orderService = inject(OrderService);
  private _toastService = inject(ToastService);
  private _loadingService = inject(LoadingService);
  private _productService = inject(ProductService);
  private _clientesService = inject(ClientesService);
  private _authSessionService = inject(AuthSessionService);


  public selectedCustomer: ICustomer | undefined;

  public subtotal = 0;
  public discount!: IDiscount;
  public estimatedTax = 0;
  public total = 0;

  public settingHeader = settingHeader;
  public customerForm!: FormGroup;
  public productsForm!: FormGroup;

  public customers: ICustomer[] = [];
  public products: IProduct[] = [];
  public filteredCustomers: ICustomer[] = [];
  public filteredProducts: IProduct[] = [];
  public orderItems: IOrderItem[] = [];
  public order!: IOrderPayload;


  public customerModalOpen = false;
  public productModalOpen = false;
  private selectedProductIds = new Set<string | number>();

  private _loggedUser: IUser | null = null;
  private _destroy$ = new Subject<void>();

  private coverCache = new Map<string, string | null>();

  ngOnInit() {
    addIcons({
      trashOutline,
      removeOutline,
      addOutline,
      closeOutline,
      chevronDownOutline,
      checkmarkOutline,
    });

    this.buildFormArray();
    this.buildCustomerForm();
    this.buildProductsForm();

    this._loggedUser = this._authSessionService.getCurrentUser();
    this.initializeOrder();

  
    this.loadLookupsFromDB();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  public getStock(raw: any): number {
    const s =
      raw?.stock ??
      raw?.existencias ??
      raw?.cantidadDisponible ??
      raw?.quantityAvailable ??
      raw?.inventory ??
      raw?.inventario ??
      0;
    const n = Number(s);
    return isNaN(n) ? 0 : Math.max(0, n);
  }
  public isOutOfStock(p: IProduct | any): boolean {
    return this.getStock(p) <= 0;
  }
  private clampToStock(item: IOrderItem) {
    const max = this.getStock(item.product);
    if (item.quantity > max) item.quantity = max;
  }

 
  get discountValue(): number {
    if (!this.discount) return 0;
    const value = this.discount.value || 0;
    return this.discount.type === DiscountTypeValues.AMOUNT
      ? value
      : this.subtotal * (value / 100);
  }

  public updateTotals() {
    this.subtotal = this.orderItems.reduce(
      (sum, p) => sum + (p.product as any).salePrice * p.quantity,
      0
    );
    this.calculateOrderTotal();
  }

  private calculateOrderTotal() {
    const discountValue = this.discount?.value || 0;

    if (this.discount?.type === DiscountTypeValues.AMOUNT) {
      this.total = this.subtotal - discountValue + this.estimatedTax;
    } else if (this.discount?.type === DiscountTypeValues.PERCENTAGE) {
      const percentage = discountValue / 100;
      const discount = this.subtotal * percentage;
      this.total = this.subtotal - discount + this.estimatedTax;
    } else {
      this.total = this.subtotal + this.estimatedTax;
    }
  }


  public getImageSrc(product: IProduct): string {
    const id = String((product as any).id ?? "");
    const cached = this.coverCache.get(id) || null;

    const fromImages =
      product.images && product.images.length > 0 ? product.images[0] : null;

    const src = fromImages || cached;
    return src || "assets/icon/default-product.svg";
  }

  public isOrderInvalid(): boolean {
    return !this.selectedCustomer || this.orderItems.length === 0;
  }

  public actionCompleted() {
    if (this.isOrderInvalid()) {
      this._toastService.showToast(invalidFormMessage);
      return;
    }
    const data = { completed: true };
    this._modalCtrl.dismiss(data);
  }

  public removeSelectedCustomer() {
    this.selectedCustomer = undefined;
  }

  public removeItemFromOrder(itemId: string) {
    this.orderItems = this.orderItems.filter((p) => p.id !== itemId);
    this.updateTotals();
  }

  public increaseQuantity(item: IOrderItem) {
    const max = this.getStock(item.product);
    if (item.quantity >= max) {
      this._toastService.showToast({
        message: "No hay más stock disponible.",
        color: "warning",
      });
      return;
    }
    item.quantity++;
    this.updateTotals();
  }

  public decreaseQuantity(item: IOrderItem) {
    if (item.quantity > 1) {
      item.quantity--;
      this.updateTotals();
    }
  }


  private onlyDigits(t: string) {
    return (t || "").toString().replace(/\D/g, "");
  }

  private normalizeText(v: string = ""): string {
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


  public onCustomerSearch(ev: any) {
    const term = ev?.detail?.value ?? "";
    this.filteredCustomers = this.filterList(this.customers, term, [
      (c) => c.fullname,
      (c) => c.email || "",
      (c) => c.mobile || "",
    ]);
  }

  public onCustomerRadioChange(ev: CustomEvent) {
    const selectedId = (ev as any).detail?.value;
    const found = this.customers.find(
      (c) => String(c.id) === String(selectedId)
    );
    if (found) {
      this.selectedCustomer = found;
      this.customerModalOpen = false; 
    }
  }

  public onCreateCustomer() {
   
  }

 
  public openProductsModal() {
   
    this.selectedProductIds = new Set(
      this.orderItems
        .filter((it) => !this.isOutOfStock(it.product))
        .map((it) => (it.product as any).id)
    );
    this.filteredProducts = [...this.products];
    this.productModalOpen = true;
  }

  public onProductSearch(ev: any) {
    const term = ev?.detail?.value ?? "";
    this.filteredProducts = this.filterList(this.products, term, [
      (p) => p.name,
      (p: any) => p.sku || p.codigo || "", 
    ]);
  }

  public isProductSelected(id: string | number): boolean {
    return this.selectedProductIds.has(id);
  }

  public toggleProductSelection(p: IProduct) {
    const id = (p as any).id ?? p.id;
    if (this.isOutOfStock(p)) {
      this._toastService.showToast({
        message: "Este producto no tiene stock.",
        color: "warning",
      });
      return;
    }
    if (this.selectedProductIds.has(id)) {
      this.selectedProductIds.delete(id);
    } else {
      this.selectedProductIds.add(id);
    }
  }

  public confirmProducts() {
    const ids = Array.from(this.selectedProductIds);
    const selectedProducts = this.products.filter((p: any) =>
      ids.includes(p.id)
    );

    
    const newItems = selectedProducts
      .filter((product) => !this.isOutOfStock(product)) 
      .map((product) => {
        const existing = this.orderItems.find(
          (it) => String((it.product as any).id) === String((product as any).id)
        );
        if (existing) {
          this.clampToStock(existing);
          return existing;
        }

        const item = mapProductToOrderItem(product);
        item.product.salePrice = this.toNumberPrice(
          (item.product as any).salePrice ??
            (product as any).precio ??
            (product as any).price
        );

        const stock = this.getStock(product);
        item.quantity = Math.min(1, stock); 
        return item;
      });

    
    const existingMap = new Map(
      this.orderItems.map((i) => [String((i.product as any).id), i])
    );
    newItems.forEach((ni) => {
      if (!this.isOutOfStock(ni.product)) {
        existingMap.set(String((ni.product as any).id), ni);
      }
    });
    this.orderItems = Array.from(existingMap.values());

 
    this.orderItems.forEach((it) => this.clampToStock(it));

    this.productModalOpen = false;
    this.updateTotals();
  }

  public onCreateProduct() {
   
  }

  public selectCustomer(c: ICustomer) {
    this.selectedCustomer = c;
    this.customerModalOpen = false; 
  }

 
  private buildCreatePayload(): CreatePedidoDto {
    const clienteId = this.selectedCustomer?.id as any;
    const phone = this.onlyDigits(this.selectedCustomer?.mobile || "");

    const items = this.orderItems.map((it) => ({
      producto_id: Number((it.product as any).id),
      cantidad: Number(it.quantity),
    }));

    return {
      cliente_id: clienteId,
      numero_celular: phone,
      items,
    };
  }

  public async confirmOrder() {
    if (this.isOrderInvalid()) {
      this._toastService.showToast(invalidFormMessage);
      return;
    }

    
    let stockError = false;
    this.orderItems.forEach((it) => {
      const max = this.getStock(it.product);
      if (max <= 0) stockError = true;
      if (it.quantity > max) {
        it.quantity = max;
        stockError = true;
      }
    });
    if (stockError) {
      this._toastService.showToast({
        message: "Ajustamos cantidades según stock disponible.",
        color: "warning",
      });
      this.updateTotals();
      return; 
    }

   
    this.order.userId = this._loggedUser?.idunico ?? "";
    this.order.customerId = this.selectedCustomer!.id;
    this.order.items = this.orderItems;
    this.order.discount = this.discountValue;
    this.order.estimatedTax = this.estimatedTax;
    this.order.subtotal = this.subtotal;
    this.order.total = this.total;

    
    const payload = this.buildCreatePayload();

    await this._loadingService.showLoading(waitingMessageCreatingOrder);
    try {
      const res = await this._orderService.createPedido(payload);
      console.log("[CreatePedido] result:", res);

      await this._loadingService.hideLoading();
      this._toastService.showToast(orderCreationMessages["success"]);
      this.actionCompleted();
    } catch (e: any) {
      await this._loadingService.hideLoading();
      console.error("[CreatePedido] error →", e);
      const msg =
        (e?.error?.message as string) ||
        (e?.message as string) ||
        "No se pudo crear el pedido";
      this._toastService.showToast({ message: msg, color: "danger" });
    }
  }


  private buildFormArray(): void {
    this.productsForm = this._formBuilder.group({
      products: this._formBuilder.array([]),
    });
  }
  private buildProductsForm(): void {}
  private buildCustomerForm(): void {
    this.customerForm = this._formBuilder.group({
      customer: ["", Validators.required],
    });
  }
  private initializeOrder() {
    this.order = {
      userId: "",
      customerId: "",
      items: [],
      discount: 0,
      estimatedTax: 0,
      subtotal: 0,
      total: 0,
      status: OrderStatusValue.PENDING,
      origin: OriginOfOrder.APPLICATION,
    };
  }

 
  private mapClienteApiToICustomer = (c: ClienteApi): ICustomer => ({
    id: c.id,
    fullname: c.nombre ?? "",
    email: c.correo ?? "",
    mobile: c.telefono ?? "",
    address: c.direccion ?? "",
  });

  private getCompanyId(): string {
    const company = this._authSessionService.getUserCompany?.() as any;
    return (
      company?.id ??
      company?.idunico ??
      company?.codigo ??
      ""
    )?.toString();
  }

  private toNumberPrice(v: any): number {
    if (v == null) return 0;
    if (typeof v === "number") return v;

    if (typeof v === "string") {
      const s = v.trim();
      if (s.includes(",") && s.match(/,\d{1,2}$/)) {
        const normalized = s
          .replace(/\./g, "")
          .replace(",", ".")
          .replace(/[^\d.]/g, "");
        const n = Number(normalized);
        return isNaN(n) ? 0 : n;
      }
      const cleaned = s.replace(/[^0-9.]/g, "");
      const n = Number(cleaned);
      return isNaN(n) ? 0 : n;
    }

    const n = Number(v);
    return isNaN(n) ? 0 : n;
  }

  private normalizeProductsPrices(): void {
    this.products = (this.products ?? []).map((p: any) => {
      const priceNum = this.toNumberPrice(p.salePrice ?? p.precio ?? p.price);
      return {
        ...p,
        name: p.name ?? p.nombre ?? "",
        salePrice: priceNum,
        price: priceNum,
      } as IProduct & { price: number };
    });
  }

  private async fetchProducts(companyId?: string): Promise<IProduct[]> {
    try {
      const prods = await firstValueFrom(
        this._productService.getAllProducts(companyId)
      );
      if (prods && prods.length) return prods;
    } catch {}
    const rawList = await this._productService.getAll();
    return rawList.map(this._productService.toIProduct);
  }

  
  private async hydrateProductCovers(products: IProduct[]) {
    let apiList: any[] = [];
    try {
      apiList = await this._productService.getAll(); 
    } catch {
      apiList = [];
    }

    const byId = new Map(apiList.map((a) => [String(a.id), a]));

    const tasks = products.map(async (row: any) => {
      const id = String(row.id);
      if (this.coverCache.has(id)) {
        const cached = this.coverCache.get(id)!;
        if (cached) {
          row.images = Array.isArray(row.images)
            ? [cached, ...row.images]
            : [cached];
        }
        return;
      }

      const api = byId.get(id);
      let url: string | null = null;

      try {
        if (api?.idunico) {
          url = await this._productService.getCoverUrl({
            id,
            idunico: api.idunico,
          });
        } else {
          url = await this._productService.getCoverUrl(id);
        }
      } catch {
        url = null;
      }

      this.coverCache.set(id, url);
      if (url) {
        row.images = Array.isArray(row.images) ? [url, ...row.images] : [url];
      }
    });

    await Promise.allSettled(tasks);
  }

  private async loadLookupsFromDB(): Promise<void> {
    const companyId = this.getCompanyId() || undefined;

    try {
      await this._loadingService.showLoading("Cargando catálogo...");

      const clientesApi = await this._clientesService.getClientes();
      this.customers = (clientesApi ?? []).map(this.mapClienteApiToICustomer);
      this.filteredCustomers = [...this.customers];

      this.products = await this.fetchProducts(companyId);
      this.normalizeProductsPrices();
      this.filteredProducts = [...this.products];

      
      await this.hydrateProductCovers(this.products);
      this.filteredProducts = [...this.products];
    } catch (err) {
      console.error(err);
      this._toastService.showToast({
        message: "No se pudo cargar clientes/productos.",
        color: "danger",
      });
    } finally {
      await this._loadingService.hideLoading();
    }
  }

  public async addDiscount() {
    const modal = await this._modalCtrl.create({
      component: AddDiscountToOrderComponent,
    });

    await modal.present();
    const { data } = await modal.onDidDismiss();

    if (data) {
      this.discount = data;
      this.updateTotals();
    }
  }

  
  trackByItemId = (_: number, it: IOrderItem) => it.id;
}
