// ===============================================
// src/app/pages/dashboard/products/components/product-management/product-management.component.ts
// ===============================================
import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { IonicModule, ModalController } from "@ionic/angular";
import { RouterModule, Router, NavigationEnd } from "@angular/router";
import { Subscription, filter } from "rxjs";

import {
  ProductService,
  ProductApi,
} from "src/app/core/services/bussiness/product.service";
import { ProductAddComponent } from "../product-add/product-add.component";
import {
  ProductCategoryService,
  CategoriaApi,
} from "src/app/core/services/bussiness/product-category.service";

type Status = "Activo" | "Inactivo";
type StatusKey = "activo" | "inactivo";

type CategoriaId = string;
type CategoriaNombre = string;

type FiltersPage = "root" | "estado" | "categoria";

type JSSet<T> = globalThis.Set<T>;
const JSSet = globalThis.Set;

interface UIProduct {
  id: string;
  name: string;
  stock: number;
  status: Status;
  image?: string | null;
  categoryId?: CategoriaId;
  categoryName?: CategoriaNombre;
}

@Component({
  selector: "app-product-management",
  standalone: true,
  templateUrl: "./product-management.component.html",
  styleUrls: ["./product-management.component.scss"],
  imports: [IonicModule, CommonModule, FormsModule, RouterModule],
})
export class ProductManagementComponent implements OnInit, OnDestroy {
  constructor(
    private productsSrv: ProductService,
    private modalCtrl: ModalController,
    private router: Router,
    private categorySrv: ProductCategoryService // 👈 nuevo
  ) {}

  // Estado UI
  loading = false;
  error?: string;

  // Búsqueda
  query = "";

  // Datos
  products: UIProduct[] = [];
  filtered: UIProduct[] = [];

  // Catálogo de categorías
  categoryOptions: { id: CategoriaId; name: CategoriaNombre }[] = [];

  // Filtro (igual a Pedidos)
  filters = {
    estados: new JSSet<StatusKey>(),   // múltiple
    categoria: "todas" as "todas" | CategoriaId, // única
  };

  // Modal de filtros
  isFiltersModalOpen = false;
  filtersPage: FiltersPage = "root";

  // Otros
  get activeFiltersCount(): number {
    let n = 0;
    if (this.filters.estados.size) n++;
    if (this.filters.categoria !== "todas") n++;
    return n;
  }
  get estadosArray(): StatusKey[] {
    return Array.from(this.filters.estados);
  }

  skeletons = Array.from({ length: 6 });
  private coverCache = new Map<string, string | null>();
  private subs = new Subscription();
  private readonly LIST_URL_FRAGMENT = "/product-management";

  ngOnInit(): void {
    this.loadProducts();

    // Si alguien creó/editó un producto desde otro lado
    this.subs.add(
      this.productsSrv.productChanged$.subscribe(() => this.loadProducts())
    );

    // Recargar al volver al listado
    this.subs.add(
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe((e) => {
          const url = e.urlAfterRedirects || e.url || "";
          if (this.isListUrl(url)) this.loadProducts();
        })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  ionViewWillEnter() {
    this.loadProducts();
  }

  // ===================== Data =====================
  async loadProducts() {
    this.loading = true;
    this.error = undefined;
    try {
      const apiList = await this.productsSrv.getAll();
      this.products = apiList.map(this.toUI);

      await this.hydrateCategoryOptions(apiList);
      await this.hydrateCovers(this.products, apiList);

      this.runFilters();
    } catch (e: any) {
      this.error = e?.message || "No se pudo cargar productos";
      this.products = [];
      this.filtered = [];
    } finally {
      this.loading = false;
    }
  }

  private toUI = (p: ProductApi): UIProduct => {
    const stockNum = Number(p.stock_actual ?? 0);
    const baseStatus: Status = (p.estado as Status) || "Activo";
    // Regla: stock 0 → Inactivo
    const finalStatus: Status = stockNum > 0 ? baseStatus : "Inactivo";

    return {
      id: p.id,
      name: p.nombre,
      stock: stockNum,
      status: finalStatus,
      image: null,
      categoryId: (p as any).categoria_id,
      categoryName:
        (p as any).categoria_nombre ??
        (p as any).categoria?.nombre ??
        undefined,
    };
  };

  /** Catálogo de categorías con nombre desde ProductCategoryService */
  private async hydrateCategoryOptions(apiList: ProductApi[]) {
    try {
      const cats = await this.categorySrv.getCategorias();
      if (cats?.length) {
        this.categoryOptions = cats.map((c: CategoriaApi) => ({
          id: String(c.id),
          name: String(c.nombre || c.id),
        }));
        return;
      }
    } catch {
      // seguimos con fallbacks
    }

    // Fallback 1: si el listado ya trae nombres
    const seen: Record<string, string> = {};
    for (const p of apiList as any[]) {
      const id = p?.categoria_id as string | undefined;
      const name = (p?.categoria_nombre ?? p?.categoria?.nombre) as string | undefined;
      if (id && name && !seen[id]) seen[id] = String(name);
    }
    const fromList = Object.entries(seen).map(([id, name]) => ({ id, name }));
    if (fromList.length) { this.categoryOptions = fromList; return; }

    // Fallback 2: IDs deduplicadas
    const ids: string[] = [];
    for (const p of apiList as any[]) {
      const id = p?.categoria_id as string | undefined;
      if (id && !ids.includes(id)) ids.push(id);
    }
    this.categoryOptions = ids.map((id) => ({ id, name: String(id) }));
  }

  private async hydrateCovers(uiList: UIProduct[], apiList: ProductApi[]) {
    const byId: Record<string, ProductApi> = {};
    for (const a of apiList) byId[a.id] = a;

    const tasks = uiList.map(async (row) => {
      if (this.coverCache.has(row.id)) {
        row.image = this.coverCache.get(row.id)!;
        return;
      }
      const api = byId[row.id];
      let url: string | null = null;
      try {
        if ((api as any)?.idunico) {
          url = await this.productsSrv.getCoverUrl({ id: row.id, idunico: (api as any).idunico });
        } else {
          url = await this.productsSrv.getCoverUrl(row.id);
        }
      } catch { url = null; }
      this.coverCache.set(row.id, url);
      row.image = url;
    });

    await Promise.allSettled(tasks);
  }

  // ===================== Filtros & Búsqueda =====================
  applyQueryFilter() { this.runFilters(); }

  private normalize(t: string | undefined | null): string {
    return (t || "")
      .toString()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim();
  }

  private statusKeyOf(p: UIProduct): StatusKey {
    return (p.status || "Inactivo").toLowerCase() as StatusKey;
  }

  private runFilters() {
    let arr = [...this.products];

    // Mapa id->name para apoyar la búsqueda por categoría
    const catNameById = new Map(this.categoryOptions.map(c => [c.id, this.normalize(c.name)]));

    // Búsqueda
    const q = this.normalize(this.query);
    if (q) {
      arr = arr.filter((p) => {
        const name = this.normalize(p.name);
        const catUiName = this.normalize(p.categoryName ?? "");
        const catId = this.normalize(p.categoryId ?? "");
        const catFromOptions = catNameById.get(p.categoryId ?? "") ?? "";
        return (
          name.includes(q) ||
          catUiName.includes(q) ||
          catFromOptions.includes(q) ||
          catId.includes(q)
        );
      });
    }

    // Estado (múltiple)
    if (this.filters.estados.size) {
      arr = arr.filter((p) => this.filters.estados.has(this.statusKeyOf(p)));
    }

    // Categoría (única)
    if (this.filters.categoria !== "todas") {
      arr = arr.filter((p) => p.categoryId === this.filters.categoria);
    }

    this.filtered = arr;
  }

  // ===================== Chips y modal =====================
  get categoriaSummary(): string {
    if (this.filters.categoria === "todas") return "";
    const hit = this.categoryOptions.find((c) => c.id === this.filters.categoria);
    return hit?.name || "";
  }
  get estadoSummary(): string {
    const arr = Array.from(this.filters.estados);
    if (!arr.length) return "";
    const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    return arr.map(title).join(", ");
  }

  removeFilterChip(kind: "estado" | "categoria", value?: StatusKey) {
    if (kind === "estado" && value) this.filters.estados.delete(value);
    else if (kind === "categoria") this.filters.categoria = "todas";
    this.runFilters();
  }

  openFilters() { this.filtersPage = "root"; this.isFiltersModalOpen = true; }
  closeFilters() { this.isFiltersModalOpen = false; }
  openFiltersPage(p: FiltersPage) { this.filtersPage = p; }

  onEstadoChange(est: StatusKey, checked: boolean) {
    if (checked) this.filters.estados.add(est);
    else this.filters.estados.delete(est);
    this.runFilters();
  }
  onCategoriaChange(v: "todas" | string) {
    this.filters.categoria = v;
    this.runFilters();
  }

  applyFilters() { this.closeFilters(); this.runFilters(); }
  clearAllFilters() {
    this.filters = { estados: new JSSet<StatusKey>(), categoria: "todas" };
    this.runFilters();
  }

  clearSearch() { this.query = ""; this.applyQueryFilter(); }

  // ===================== Otros =====================
  trackById(_: number, p: UIProduct) { return p.id; }

  async onAdd() {
    const modal = await this.modalCtrl.create({
      component: ProductAddComponent,
      cssClass: "option-select-modal",
      breakpoints: [0, 1],
      initialBreakpoint: 1,
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    if (data?.completed) {
      this.coverCache.clear();
      await this.loadProducts();
    }
  }

  private isListUrl(url: string): boolean {
    return url.includes(this.LIST_URL_FRAGMENT);
  }
}
