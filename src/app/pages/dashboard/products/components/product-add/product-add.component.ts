import { CommonModule } from "@angular/common";
import { Component, ViewChild, ElementRef, OnInit } from "@angular/core";
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import {
  IonicModule,
  ModalController,
  ToastController,
  NavController,
} from "@ionic/angular";
import { RouterModule, Router } from "@angular/router";

import { HeaderComponent } from "src/app/shared/components/header/header.component";
import { settingHeader } from "./product-add.const";

import {
  ProductCategoryService,
  CategoriaApi,
} from "src/app/core/services/bussiness/product-category.service";
import { ProductService } from "src/app/core/services/bussiness/product.service";

type IdLabel = { id: string; label: string };

@Component({
  selector: "app-product-add",
  standalone: true,
  templateUrl: "./product-add.component.html",
  styleUrls: ["./product-add.component.scss"],
  imports: [
    CommonModule,
    IonicModule,
    HeaderComponent,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
  ],
})
export class ProductAddComponent implements OnInit {
  public settingHeader = settingHeader;
  public form!: FormGroup;
  public saving = false;

  @ViewChild("fileInput") fileInput!: ElementRef<HTMLInputElement>;
  imageFiles: File[] = [];
  imagePreviews: string[] = [];

  isCatOpen = false;
  isSupOpen = false;
  isTaxOpen = false;

  categories: IdLabel[] = [];
  suppliers: IdLabel[] = [
    { id: "1", label: "Proveedor A" },
    { id: "2", label: "Proveedor B" },
  ];
  taxes: IdLabel[] = [
    { id: "0", label: "IVA 0%" },
    { id: "5", label: "IVA 5%" },
    { id: "19", label: "IVA 19%" },
  ];

  tmpCategoryId?: string;
  tmpSupplierId?: string;
  tmpTaxId?: string;

  constructor(
    private fb: FormBuilder,
    private modalCtrl: ModalController,
    private toastCtrl: ToastController,
    private nav: NavController,
    private router: Router,
    private categoriesSrv: ProductCategoryService,
    private productSrv: ProductService
  ) {}

  ngOnInit(): void {
    this.buildForm();
    this.loadCategories();
  }

  private buildForm() {
    this.form = this.fb.group({
      title: ["", [Validators.required, Validators.minLength(2)]],
      description: [""],
      costPrice: [null, [Validators.required, Validators.min(0)]],
      salePrice: [null, [Validators.required, Validators.min(0)]],
      stock: [0, [Validators.required, Validators.min(0)]],
      categoryId: [null, Validators.required],
      supplierId: [null],
      taxId: [null],
    });
  }

  private async loadCategories() {
    try {
      const list: CategoriaApi[] = await this.categoriesSrv.getCategorias();
      this.categories = (list || []).map((c) => ({
        id: c.id,
        label: c.nombre || `Cat. ${c.id}`,
      }));
    } catch (e) {
      await this.toast("No se pudieron cargar las categorías", "danger");
    }
  }

  pickImages() {
    this.fileInput?.nativeElement?.click();
  }

  onFilesSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (!files.length) return;

    for (const f of files) {
      this.imageFiles.push(f);
      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreviews.push(String(reader.result || ""));
      };
      reader.readAsDataURL(f);
    }
    
    input.value = "";
  }

  removeImage(i: number) {
    this.imageFiles.splice(i, 1);
    this.imagePreviews.splice(i, 1);
  }

  trackByIndex = (_: number, __: any) => _;


  decStock(ev?: Event) {
    ev?.stopPropagation();
    const cur = Number(this.form.get("stock")!.value || 0);
    this.form.get("stock")!.setValue(Math.max(cur - 1, 0));
  }
  incStock(ev?: Event) {
    ev?.stopPropagation();
    const cur = Number(this.form.get("stock")!.value || 0);
    this.form.get("stock")!.setValue(cur + 1);
  }

  get categoryLabel() {
    const id = this.form.get("categoryId")!.value as string | null;
    return this.categories.find((x) => x.id === id)?.label ?? "Categoría";
  }
  get supplierLabel() {
    const id = this.form.get("supplierId")!.value as string | null;
    return (
      this.suppliers.find((x) => x.id === id)?.label ?? "Proveedor (opcional)"
    );
  }
  get taxLabel() {
    const id = this.form.get("taxId")!.value as string | null;
    return this.taxes.find((x) => x.id === id)?.label ?? "Impuesto";
  }


  openCatSheet() {
    this.tmpCategoryId = this.form.get("categoryId")!.value;
    this.isCatOpen = true;
  }
  openSupSheet() {
    this.tmpSupplierId = this.form.get("supplierId")!.value;
    this.isSupOpen = true;
  }
  openTaxSheet() {
    this.tmpTaxId = this.form.get("taxId")!.value;
    this.isTaxOpen = true;
  }
  closeCat() {
    this.isCatOpen = false;
  }
  closeSup() {
    this.isSupOpen = false;
  }
  closeTax() {
    this.isTaxOpen = false;
  }

  applyCat() {
    this.form.get("categoryId")!.setValue(this.tmpCategoryId ?? null);
    this.closeCat();
  }
  applySup() {
    this.form.get("supplierId")!.setValue(this.tmpSupplierId ?? null);
    this.closeSup();
  }
  applyTax() {
    this.form.get("taxId")!.setValue(this.tmpTaxId ?? null);
    this.closeTax();
  }

  
  async onSubmit() {
    if (!this.form || this.form.invalid || this.saving) return;
    this.saving = true;

    try {
    
      const res = await this.productSrv.createProduct({
        nombre: this.form.value.title,
        descripcion: this.form.value.description || "",
        precio_costo: Number(this.form.value.costPrice || 0),
        precio_venta: Number(this.form.value.salePrice || 0),
        stock: Number(this.form.value.stock || 0),
        categoria_id: String(this.form.value.categoryId),
        proveedor_id: this.form.value.supplierId
          ? String(this.form.value.supplierId)
          : undefined,
        impuesto:
          this.form.value.taxId != null ? Number(this.form.value.taxId) : 0,
      });

      
      if (this.imageFiles.length) {
        const idunico =
          res.idunico ||
          res.raw?.idunico ||
          res.raw?.data?.idunico ||
          res.id ||
          res.raw?.data?.id;
        if (!idunico) {
          await this.toast(
            'Producto creado, pero no se recibió "idunico" para subir imágenes.',
            "danger"
          );
        } else {
          await this.productSrv.uploadImages(String(idunico), this.imageFiles);
        }
      }

      await this.toast("Producto guardado correctamente", "success");

      
      const top = await this.modalCtrl.getTop();
      if (top) {
        await this.modalCtrl.dismiss({ completed: true });
      } else {
        if (history.length > 1) this.nav.back();
        else this.router.navigate(["/dashboard/products"]);
      }
    } catch (e: any) {
      const msg = e?.message || "No se pudo guardar el producto";
      await this.toast(msg, "danger");
    } finally {
      this.saving = false;
    }
  }

  private async toast(
    message: string,
    color: "success" | "danger" | "primary" = "success"
  ) {
    const t = await this.toastCtrl.create({ message, duration: 2200, color });
    await t.present();
  }
}
