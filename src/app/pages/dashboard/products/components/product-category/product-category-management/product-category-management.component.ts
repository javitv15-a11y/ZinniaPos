// src/app/pages/dashboard/products/components/product-category-management/product-category-management.component.ts
import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule, ToastController, ModalController } from "@ionic/angular";
import { HttpClientModule } from "@angular/common/http";
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from "@angular/forms";
import { RouterModule } from "@angular/router";

import {
  ProductCategoryService,
  CategoriaApi,
  CreateCategoriaDto,
  UpdateCategoriaDto,
} from "src/app/core/services/bussiness/product-category.service";

interface CategoriaUI {
  id: string;
  nombre: string;
  descripcion?: string;
  impuesto: number;           // % (ej: 5 = 5%)
  fechaRegistroDate?: Date;   // parse de fecha_registro
}

type ModalMode = 'create' | 'edit';

@Component({
  selector: "app-product-category-management",
  standalone: true,
  templateUrl: "./product-category-management.component.html",
  styleUrls: ["./product-category-management.component.scss"],
  imports: [CommonModule, IonicModule, HttpClientModule, FormsModule, ReactiveFormsModule, RouterModule],
})
export class ProductCategoryManagementComponent implements OnInit {
  loading = false;
  error?: string;

  categorias: CategoriaUI[] = [];
  filtered: CategoriaUI[] = [];
  query = "";

  // ===== Modal embebido =====
  modalOpen = false;
  modalMode: ModalMode = 'create';
  editing?: CategoriaUI;
  form!: FormGroup;
  saving = false;

  constructor(
    private categorySrv: ProductCategoryService,
    private modalCtrl: ModalController,
    private toastCtrl: ToastController,
    private fb: FormBuilder,
  ) {}

  ngOnInit() {
    this.load();
    this.buildForm();
  }

  private buildForm() {
    this.form = this.fb.group({
      nombre: ['', [Validators.required, Validators.maxLength(80)]],
      descripcion: ['', [Validators.maxLength(160)]],
      impuesto: [null, [Validators.required, Validators.min(0), Validators.max(100)]],
      fecha_registro: [''], // yyyy-MM-dd
    });
  }

  async load(ev?: CustomEvent) {
    this.loading = true;
    this.error = undefined;

    try {
      const raw = await this.categorySrv.getCategorias();
      this.categorias = (raw ?? []).map(this.mapCategoriaBase);
      this.applyFilter();
    } catch (e: any) {
      this.error = e?.message || "Error al cargar categorías";
    } finally {
      this.loading = false;
      (ev?.target as HTMLIonRefresherElement)?.complete?.();
    }
  }

  private mapCategoriaBase = (c: CategoriaApi): CategoriaUI => {
    const fecha = (c.fecha_registro ?? "").toString().replace(" ", "T");
    const fr = fecha ? new Date(fecha) : undefined;

    return {
      id: String(c.id ?? ""),
      nombre: String(c.nombre ?? "").trim(),
      descripcion: String(c.descripcion ?? "").trim() || undefined,
      impuesto: Number(c.impuesto ?? 0),
      fechaRegistroDate: fr && !Number.isNaN(fr.getTime()) ? fr : undefined,
    };
  };

  applyFilter() {
    const q = this.query.trim().toLowerCase();
    if (!q) {
      this.filtered = [...this.categorias];
      return;
    }
    this.filtered = this.categorias.filter((c) => {
      const nombre = (c.nombre ?? "").toLowerCase();
      const descripcion = (c.descripcion ?? "").toLowerCase();
      const impuesto = String(c.impuesto ?? "").toLowerCase();
      return nombre.includes(q) || descripcion.includes(q) || impuesto.includes(q);
    });
    this.filtered = [...this.filtered];
  }

  clearSearch() {
    this.query = "";
    this.applyFilter();
  }

  trackById = (_: number, c: CategoriaUI) => this.getId(c) || _;

  getId(c: CategoriaUI | any) {
    return String(c?.id ?? c?.categoria_id ?? c?._id ?? "").trim();
  }

  // ===== Modal handlers =====
  onAdd() {
    this.modalMode = 'create';
    this.editing = undefined;
    this.form.reset({
      nombre: '',
      descripcion: '',
      impuesto: null,
      fecha_registro: '',
    });
    this.modalOpen = true;
  }

  onEdit(c: CategoriaUI) {
    this.modalMode = 'edit';
    this.editing = c;
    this.form.reset({
      nombre: c.nombre ?? '',
      descripcion: c.descripcion ?? '',
      impuesto: c.impuesto ?? null,
      fecha_registro: c.fechaRegistroDate ? this.formatDateInput(c.fechaRegistroDate) : '',
    });
    this.modalOpen = true;
  }

  async submitModal() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return this.presentToast('Revisa los campos del formulario');
    }

    const nombre = String(this.form.value.nombre ?? '').trim();
    const descripcion = String(this.form.value.descripcion ?? '').trim();
    const impuesto = Number(String(this.form.value.impuesto ?? '0').replace(',', '.'));
    const fecha_registro = String(this.form.value.fecha_registro ?? '').trim();

    if (!nombre) return this.presentToast('El nombre es obligatorio');
    if (Number.isNaN(impuesto)) return this.presentToast('El impuesto debe ser numérico');

    this.saving = true;
    try {
      if (this.modalMode === 'create') {
        const dto: CreateCategoriaDto = {
          nombre,
          impuesto,
          ...(fecha_registro ? { fecha_registro } : {}),
        };
        const res = await this.categorySrv.createCategoria(dto);
        if (res?.ok) await this.presentToast('Categoría creada');
      } else {
        const dto: UpdateCategoriaDto = {
          nombre,
          impuesto,
          ...(fecha_registro ? { fecha_registro } : {}),
        };
        await this.categorySrv.updateCategoria(this.getId(this.editing!), dto, { descripcion });
        await this.presentToast('Cambios guardados');
      }

      this.modalOpen = false;
      await this.load();
    } catch (e: any) {
      this.presentToast(e?.message || 'No se pudo guardar');
    } finally {
      this.saving = false;
    }
  }

  closeModal() {
    this.modalOpen = false;
  }

  // ===== Eliminar =====
  async onDelete(cat: CategoriaUI) {
    // Si prefieres, puedes mantener un AlertController aquí
    const ok = confirm(`¿Seguro que deseas eliminar "${cat.nombre}"?`);
    if (!ok) return;
    try {
      await this.categorySrv.deleteCategoria(this.getId(cat));
      this.presentToast('Categoría eliminada');
      await this.load();
    } catch (e: any) {
      this.presentToast(e?.message || 'No se pudo eliminar');
    }
  }

  private formatDateInput(d: Date) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private async presentToast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2000, position: 'bottom' });
    await t.present();
  }

  // Sincroniza el range -> input
onTaxRangeChange(ev: CustomEvent) {
  const v = Number((ev.detail as any).value ?? 0);
  if (Number.isNaN(v)) return;
  this.form.patchValue({ impuesto: this.clamp(round2(v), 0, 100) }, { emitEvent: false });
}

// Normaliza el input (coma -> punto, 2 decimales, límites)
normalizeTaxInput() {
  const raw = String(this.form.value.impuesto ?? '').toString().replace(',', '.');
  let v = Number(raw);
  if (Number.isNaN(v)) v = 0;
  v = this.clamp(round2(v), 0, 100);
  this.form.patchValue({ impuesto: v }, { emitEvent: false });
}

// Helpers
private clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}



