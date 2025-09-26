import { CommonModule } from "@angular/common";
import { Component, OnInit, inject } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { IonicModule, ModalController } from "@ionic/angular";
import { MovementsPurchaseSupplierComponent } from "../movements-purchase-supplier/movements-purchase-supplier.component";

type MovementType = "in" | "out";

interface UIMovement {
  id: string;
  type: MovementType;
  subtype?: string | null;
  partner?: string | null;
  items: number;
  date: string | Date;
  doc?: string | null;
  title?: string;
  subtitle?: string;
}

@Component({
  selector: "app-movements-management",
  standalone: true,
  templateUrl: "./movements-management.component.html",
  styleUrls: ["./movements-management.component.scss"],
  imports: [IonicModule, CommonModule, FormsModule, RouterModule],
})
export class MovementsManagementComponent implements OnInit {
  // ===== UI =====
  loading = false;
  query = "";

  // Inyecciones
  private router = inject(Router);
  private modalCtrl = inject(ModalController);

  // ===== Filtros (solo tipo) =====
  types = new Set<MovementType>(); // Entradas / Salidas
  isFiltersModalOpen = false; // controla el <ion-modal>

  // ===== Datos =====
  movements: UIMovement[] = [];
  filtered: UIMovement[] = [];
  skeletons = Array.from({ length: 6 });

  ngOnInit(): void {
    this.loadMock();
  }

  // ===== Modal de filtros =====
  openFilters() {
    this.isFiltersModalOpen = true;
  }
  closeFilters() {
    this.isFiltersModalOpen = false;
  }
  applyFilters() {
    this.isFiltersModalOpen = false;
    this.applyFilter();
  }
  clearAllFilters() {
    this.types.clear();
    this.applyFilter();
  }
  onTipoChange(t: MovementType, checked: boolean) {
    checked ? this.types.add(t) : this.types.delete(t);
  }

  // Chips / badge
  get activeFiltersCount(): number {
    return this.types.size ? 1 : 0;
  }
  get tiposArray(): MovementType[] {
    return Array.from(this.types);
  }
  removeTipoChip(t: MovementType) {
    this.types.delete(t);
    this.applyFilter();
  }

  // ====== Data (Mock local sin API) ======
  loadMock() {
    this.movements = [
      { id: "m1", type: "out", subtype: "Venta a cliente", partner: "Juan López", items: 3, date: "2024-10-15", doc: "B005" },
      { id: "m2", type: "out", subtype: "Devolución proveedor", partner: "Kitronik Mayorista", items: 3, date: "2024-10-15", doc: "B005" },
      { id: "m3", type: "out", subtype: "Merma (daño, vencimiento, pérdida)", partner: "Kitronik Mayorista", items: 3, date: "2024-10-15", doc: "B005" },
      { id: "m4", type: "out", subtype: "Consumo interno", items: 3, date: "2024-10-15", doc: "B005" },
      { id: "m5", type: "out", subtype: "Ajuste negativo", items: 3, date: "2024-10-15", doc: "B005" },
      { id: "m6", type: "in",  subtype: "Compra proveedor", partner: "Kitronik Mayorista", items: 10, date: "2024-10-18", doc: "B005" },
      { id: "m7", type: "in",  subtype: "Devolución cliente", partner: "Arturo López", items: 1, date: "2024-10-18", doc: "B005" },
      { id: "m8", type: "in",  subtype: "Producción interna", items: 1, date: "2024-10-18", doc: "B005" },
      { id: "m9", type: "in",  subtype: "Ajuste positivo", items: 1, date: "2024-10-18", doc: "B005" },
    ];
    this.applyFilter();
  }

  // ====== Filtros / búsqueda ======
  applyFilter() {
    const q = (this.query || "").trim().toLowerCase();
    let out = [...this.movements];

    if (q) {
      out = out.filter(
        (m) =>
          (m.subtype || "").toLowerCase().includes(q) ||
          (m.partner || "").toLowerCase().includes(q) ||
          (m.doc || "").toLowerCase().includes(q)
      );
    }

    if (this.types.size) {
      out = out.filter((m) => this.types.has(m.type));
    }

    // Orden por fecha desc
    out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    this.filtered = out;
  }

  // === Compat: alias para el template viejo ===
  toggleType(t: MovementType, checked: boolean) {
    this.onTipoChange(t, checked);
  }

  resetFilters() {
    this.clearAllFilters();
  }

  applyAndClose() {
    this.applyFilters();
  }

  clearSearch() {
    this.query = "";
    this.applyFilter();
  }

  reload(ev?: CustomEvent) {
    this.applyFilter();
    (ev?.target as HTMLIonRefresherElement)?.complete?.();
  }

  trackById(_: number, m: UIMovement) {
    return m.id;
  }

  // === Quick Add (entrada/salida) ===
  isQuickAddOpen = false;
  quickAddMode: "in" | "out" = "in"; // por ahora abrimos "entrada"

  get quickAddTitle(): string {
    return this.quickAddMode === "in" ? "Tipo de entrada" : "Tipo de salida";
  }

  // Navegación / acciones
  openMovement(id: string) {
    console.log("Abrir detalle de movimiento", id);
  }
  addEntry() {
    console.log("Agregar Entrada");
  }
  addExit() {
    console.log("Agregar Salida");
  }
  onQuickAdd() {
    this.quickAddMode = "in";
    this.isQuickAddOpen = true;
  }
  closeQuickAdd() {
    this.isQuickAddOpen = false;
  }

  // === NUEVO: abrir el componente de compra como modal ===
  private async openPurchaseSupplierSheet() {
    const modal = await this.modalCtrl.create({
      component: MovementsPurchaseSupplierComponent,
      cssClass: "quick-sheet",
      breakpoints: [0, 0.45, 0.7, 0.95],
      initialBreakpoint: 0.95,
      canDismiss: true,
    });

    await modal.present();

    const { role } = await modal.onWillDismiss();
    if (role === "saved") {
      // Si el formulario guardó algo, refrescamos la lista
      this.reload();
    }
  }

  selectQuickAction(
    kind: "compra_proveedor" | "devolucion_cliente" | "ajuste_inventario" | "produccion"
  ) {
    this.isQuickAddOpen = false;

    switch (kind) {
      case "compra_proveedor":
        // Abrir el componente MovementsPurchaseSupplierComponent dentro de un modal
        this.openPurchaseSupplierSheet();
        break;

      case "devolucion_cliente":
        console.log("QuickAdd: Entrada → Devolución cliente");
        this.addEntry();
        break;

      case "ajuste_inventario":
        console.log("QuickAdd: Entrada → Ajuste inventario");
        this.addEntry();
        break;

      case "produccion":
        console.log("QuickAdd: Entrada → Producción propia");
        this.addEntry();
        break;
    }
  }
}
