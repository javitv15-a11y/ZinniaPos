import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import {
  FormGroup,
  Validators,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  FormsModule,
  FormControl,
} from "@angular/forms";
import { IonicModule, ModalController, ToastController } from "@ionic/angular";
import { RouterModule } from "@angular/router";

import { HeaderComponent } from "src/app/shared/components/header/header.component";
import { settingHeader } from "./product-supplier.const";

import { SupplierService } from "src/app/core/services/bussiness/supplier.service";
import { CreateSupplierPayload } from "src/app/core/interfaces/bussiness/supplier.interface";
import { finalize } from "rxjs/operators";

type SupplierForm = FormGroup<{
  name: FormControl<string>;
  phone: FormControl<string>;
  email: FormControl<string>;
  address: FormControl<string>;
}>;

@Component({
  selector: "app-product-supplier",
  standalone: true,
  templateUrl: "./product-supplier.component.html",
  styleUrls: ["./product-supplier.component.scss"],
  imports: [
    CommonModule,
    IonicModule,
    HeaderComponent,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
  ],
})
export class ProductSupplierComponent {
  public settingHeader = settingHeader;
  public supplierForm!: SupplierForm;
  public saving = false;

  // Ejemplo de cómo obtener userId (ajústalo a tu AuthService / storage)
  private get userId(): string {
    // return this.auth.currentUserId;
    return localStorage.getItem("userId") || "CURRENT_USER_ID";
  }

  constructor(
    private fb: NonNullableFormBuilder,
    private modalCtrl: ModalController,
    private toastCtrl: ToastController,
    private suppliersService: SupplierService
  ) {}

  ionViewWillEnter() {
    this.buildForm();
  }

  private buildForm(): void {
    this.supplierForm = this.fb.group({
      name: this.fb.control("", [Validators.required, Validators.minLength(2)]),
      phone: this.fb.control("", [Validators.required]),
      email: this.fb.control("", [Validators.required, Validators.email]),
      address: this.fb.control("", [Validators.required]),
    });
  }

  public isInvalid(ctrl: keyof SupplierForm["controls"]): boolean {
    const c = this.supplierForm.controls[ctrl];
    return c.invalid && (c.dirty || c.touched);
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

  public async onSubmit() {
    if (!this.supplierForm || this.supplierForm.invalid || this.saving) return;

    this.saving = true;
    const payload: CreateSupplierPayload = this.supplierForm.getRawValue();

    this.suppliersService
      .saveSupplier(payload)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: async (ok) => {
          if (ok) {
            await this.showToast("Proveedor guardado", "success");
            // pequeño respiro para que el usuario lo alcance a ver
            await new Promise((r) => setTimeout(r, 150));
            this.modalCtrl.dismiss({ completed: true, supplier: payload });
          } else {
            await this.showToast("No se pudo guardar el proveedor", "danger");
          }
        },
        error: async (err) => {
          console.error(err);
          await this.showToast(err?.message || "Error al guardar", "danger");
        },
      });
  }
}
