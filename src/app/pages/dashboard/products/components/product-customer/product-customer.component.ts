import { CommonModule } from "@angular/common";
import { Component, OnDestroy } from "@angular/core";
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { IonicModule, ModalController, ToastController } from "@ionic/angular";
import { RouterModule } from "@angular/router";
import { HeaderComponent } from "src/app/shared/components/header/header.component";
import { settingHeader } from "./product-customer.consts";
import { Subscription } from "rxjs";
import {
  ClientesService,
  CreateClienteDto,
} from "src/app/core/services/bussiness/clientes.service";
import { ToastService } from "src/app/core/services/utils/toast.service";

@Component({
  selector: "app-product-customer",
  standalone: true,
  templateUrl: "./product-customer.component.html",
  styleUrls: ["./product-customer.component.scss"],
  imports: [
    CommonModule,
    IonicModule,
    HeaderComponent,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
  ],
})
export class ProductCustomerComponent implements OnDestroy {
  public settingHeader = { ...settingHeader, rightDisabled: true };
  public customerForm!: FormGroup;
  public saving = false;

  private sub?: Subscription;

  constructor(
    private fb: FormBuilder,
    private modalCtrl: ModalController,
    private clientesSrv: ClientesService, // <- cambia el servicio
    private _toastService: ToastService
  ) {}

  ionViewWillEnter() {
    this.buildForm();
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  private buildForm(): void {
    this.customerForm = this.fb.group({
      name: ["", [Validators.required, Validators.minLength(2)]],
      email: ["", [Validators.required, Validators.email]],
      phone: ["", [Validators.required, Validators.minLength(5)]],
      address: ["", [Validators.required, Validators.minLength(3)]],
    });

    this.sub = this.customerForm.statusChanges.subscribe(() => {
      this.settingHeader = {
        ...this.settingHeader,
        rightDisabled: this.customerForm.invalid || this.saving,
      };
    });
  }

  public onSubmit(): void {
    this.save();
  }

  public async save(): Promise<void> {
    if (!this.customerForm || this.customerForm.invalid || this.saving) {
      this.customerForm?.markAllAsTouched();
      await this._toastService.showToast({
        message: "Completa los campos requeridos",
        color: "warning",
      });
      return;
    }

    this.saving = true;
    this.settingHeader = { ...this.settingHeader, rightDisabled: true };

    try {
      const nowIso = new Date().toISOString().slice(0, 19).replace("T", " ");
      const f = this.customerForm.getRawValue();
      const payload: CreateClienteDto = {
        nombre: String(f.name).trim(),
        correo: String(f.email).trim(),
        telefono: String(f.phone).trim(),
        direccion: String(f.address).trim(),
        fecha_registro: nowIso,
      };

      const ok = await this.clientesSrv.createCliente(payload); 
      if (ok) {
        await this._toastService.showToast({
          message: "Cliente creado",
          color: "success",
        });
        this.modalCtrl.dismiss({ completed: true, customer: payload });
      } else {
        throw new Error("El servidor no confirmó el registro");
      }
    } catch (e: any) {
      await this._toastService.showToast({
        message: e?.message || "No se pudo crear el cliente",
        color: "danger",
      });
    } finally {
      this.saving = false;
      this.settingHeader = {
        ...this.settingHeader,
        rightDisabled: this.customerForm.invalid,
      };
    }
  }

  public close() {
    this.modalCtrl.dismiss();
  }
}
