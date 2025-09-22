// src/app/pages/dashboard/appointments/components/upsert-appointment/upsert-appointment.component.ts
import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormsModule,
} from "@angular/forms";
import {
  AlertController,
  IonicModule,
  ModalController,
  ToastController,
  NavController,
} from "@ionic/angular";
import { addIcons } from "ionicons";
import { chevronForwardOutline } from "ionicons/icons";
import { firstValueFrom } from "rxjs";
import { Router } from "@angular/router";

import { upsertAppointmentHeader } from "./upsert-appointment.consts";
import { Iheader } from "src/app/core/interfaces/header.interface";

import { DirectivesModule } from "src/app/core/directives/directives.module";
import { OpenSelectOptionsService } from "src/app/core/services/utils/open-select-options.service";
import { HeaderComponent } from "src/app/shared/components/header/header.component";
import {
  consultationTypeConfig,
  mapObjectToSelectOptions,
} from "../../appointments.consts";

import { AppointmentTypeService } from "src/app/core/services/bussiness/appointment-type.service";
import {
  ISelectModalConfig,
  ISelectOption,
} from "src/app/core/interfaces/select-options-modal.interface";
import { IAppointmentType } from "src/app/core/interfaces/bussiness/appointments-type.interface";

import {
  ClientesService,
  ClienteApi,
} from "src/app/core/services/bussiness/clientes.service";
import { ApiService } from "src/app/data/api.service";

@Component({
  selector: "app-upsert-appointment",
  templateUrl: "./upsert-appointment.component.html",
  styleUrls: ["./upsert-appointment.component.scss"],
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
export class UpsertAppointmentComponent implements OnInit {
  public settingHeader: Iheader = upsertAppointmentHeader;
  public loading = true;

  public typeAppointmentsForm!: FormGroup;
  public dateForm!: FormGroup;
  public observaciones = "";

  private _appointmentTypes: IAppointmentType[] = [];
  private consultationTypeConfigLocal: ISelectModalConfig = {
    ...consultationTypeConfig,
  };

  public customers: ClienteApi[] = [];
  public selectedCustomer?: ClienteApi;
  private customerSelectCfg: ISelectModalConfig = {
    headerTitle: "Seleccionar cliente",
    optionsList: [],
    actionButton: false,
    multiple: false,
  };
  private selectedClienteId: number | null = null;

  private openingDate = false;
  private openingTime = false;

  constructor(
    private _formBuilder: FormBuilder,
    private _modalCtrl: ModalController,
    private _alertCtrl: AlertController,
    private _toastCtrl: ToastController,
    private _appointmentTypesService: AppointmentTypeService,
    private _clientesService: ClientesService,
    private _openSelectOptionsService: OpenSelectOptionsService,
    private _api: ApiService,
    private nav: NavController,
    private router: Router
  ) {
    addIcons({ chevronForwardOutline });
    this.buildTypeAppointmentsForm();
    this.buildDateForm();
  }

  ngOnInit() {
    Promise.allSettled([
      this.getAppointmentTypes(),
      this.loadCustomers(),
    ]).finally(() => (this.loading = false));
  }

  getAppointmentTypeLabel(): string {
    const value = this.typeAppointmentsForm.get("appointmentType")?.value;
    const option = this._appointmentTypes.find(
      (opt) => String(opt.id) === String(value)
    );
    return option?.name || "";
  }
  get selectedCustomerLabel(): string {
    return this.selectedCustomer?.nombre || "";
  }
  get timeRangeLabel(): string {
    const s = this.dateForm?.get("time")?.value || "";
    const e = this.dateForm?.get("timeEnd")?.value || "";
    if (s && e) return `${s} — ${e}`;
    if (s) return s;
    return "";
  }

  async selectCustomer() {
    const data = await this._openSelectOptionsService.open({
      ...this.customerSelectCfg,
    });
    if (!data) return;
    const value =
      typeof data === "object" && data.value != null ? data.value : data;
    const found = this.customers.find((c) => String(c.id) === String(value));
    if (found) {
      this.selectedCustomer = found;
      this.selectedClienteId = Number(found.id);
    }
  }

  async selectAppointmentType() {
    const data = await this._openSelectOptionsService.open({
      ...this.consultationTypeConfigLocal,
    });
    if (data)
      this.typeAppointmentsForm.get("appointmentType")?.setValue(data.value);
  }

  async selectDate() {
    if (this.openingDate) return;
    this.openingDate = true;

    const alert = await this._alertCtrl.create({
      header: "Selecciona fecha",
      inputs: [
        {
          name: "date",
          type: "date",
          value: this.dateForm.get("date")?.value || this.todayISO(),
        },
      ],
      buttons: [
        { text: "Cancelar", role: "cancel" },
        { text: "Aceptar", role: "confirm" },
      ],
    });
    await alert.present();
    const { role, data } = await alert.onDidDismiss();
    if (role === "confirm") {
      const date = data?.values?.date || data?.date;
      if (date) this.dateForm.get("date")?.setValue(date);
    }
    this.openingDate = false;
  }

  async selectTimeRange() {
    if (this.openingTime) return;
    this.openingTime = true;

    const alert = await this._alertCtrl.create({
      header: "Selecciona hora",
      inputs: [
        {
          name: "start",
          type: "time",
          value: this.dateForm.get("time")?.value || "09:00",
        },
        {
          name: "end",
          type: "time",
          value: this.dateForm.get("timeEnd")?.value || "10:00",
        },
      ],
      buttons: [
        { text: "Cancelar", role: "cancel" },
        { text: "Aceptar", role: "confirm" },
      ],
    });
    await alert.present();
    const { role, data } = await alert.onDidDismiss();
    if (role === "confirm") {
      const start = data?.values?.start || data?.start;
      const end = data?.values?.end || data?.end;
      if (start) this.dateForm.get("time")?.setValue(start);
      if (end) this.dateForm.get("timeEnd")?.setValue(end);
    }
    this.openingTime = false;
  }

  private buildTypeAppointmentsForm() {
    this.typeAppointmentsForm = this._formBuilder.group({
      appointmentType: ["", Validators.required],
    });
  }
  private buildDateForm() {
    this.dateForm = this._formBuilder.group({
      date: ["", Validators.required],
      time: ["", Validators.required],
      timeEnd: [""],
    });
  }

  private async getAppointmentTypes() {
    return new Promise<void>((resolve) => {
      this._appointmentTypesService.getAppointmentTypes("2808").subscribe({
        next: (response) => {
          this._appointmentTypes = response;
          this.consultationTypeConfigLocal = {
            ...this.consultationTypeConfigLocal,
            optionsList: mapObjectToSelectOptions(response),
          };
          resolve();
        },
        error: () => resolve(),
      });
    });
  }
  private async loadCustomers() {
    try {
      const list = await this._clientesService.getClientes();
      this.customers = list ?? [];
      this.customerSelectCfg = {
        ...this.customerSelectCfg,
        optionsList: this.mapClientesToSelectOptions(this.customers),
      };
    } catch (e) {
      console.error("[Customers] error →", e);
    }
  }
  private mapClientesToSelectOptions(list: ClienteApi[]): ISelectOption[] {
    return (list || []).map((c) => ({
      title: c.nombre ?? `Cliente ${c.id}`,
      subtitle: [c.correo, c.telefono].filter(Boolean).join(" • ") || undefined,
      value: c.id,
    }));
  }

  public actionCompleted = () => this.confirmAppointment();

  public async confirmAppointment() {
    if (this.typeAppointmentsForm.invalid || this.dateForm.invalid) {
      this.typeAppointmentsForm.markAllAsTouched();
      this.dateForm.markAllAsTouched();
      return;
    }
    if (!this.selectedClienteId) {
      await this.toast("Selecciona un cliente antes de confirmar", "danger");
      return;
    }

    const tipoConsulta = this.typeAppointmentsForm.value.appointmentType as
      | number
      | string;
    const fecha = this.dateForm.value.date as string;
    const horaInicio = this.dateForm.value.time as string;
    const horaFin =
      (this.dateForm.value.timeEnd as string) ||
      this.addMinutes(horaInicio, 60);

    const form = {
      ClienteId: String(this.selectedClienteId),
      TipoConsulta: String(tipoConsulta),
      FechaCita: fecha,
      HoraInicio: horaInicio,
      HoraFin: horaFin,
      Estado: "Agendada",
      Observaciones: this.observaciones?.trim() || "Primera consulta médica",
    };

    const endpoints = ["/citas", "/citas/", "/appointments", "/appointments/"];
    let lastErr: any;

    try {
      for (const url of endpoints) {
        try {
          await firstValueFrom(this._api.postUrlEncoded<any>(url, form));
          await this.toast("Cita creada correctamente", "success");
          const top = await this._modalCtrl.getTop();
          if (top) {
            await this._modalCtrl.dismiss({
              completed: true,
              appointment: form,
            });
          } else {
            if (history.length > 1) this.nav.back();
            else this.router.navigate(["/dashboard/appointments"]);
          }
          return;
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr;
    } catch (e: any) {
      const status = e?.status ?? e?.error?.status;
      const msg =
        status === 0
          ? "No se pudo contactar al servidor (CORS/Red). Verifica que /citas acepte POST desde tu origen."
          : e?.error?.message || e?.message || "No se pudo crear la cita";
      console.error("[CreateAppointment] error →", e);
      await this.toast(msg, "danger");
    }
  }

  
  private todayISO(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  private addMinutes(hhmm: string, minutes: number): string {
    const [h, m] = (hhmm || "00:00").split(":").map(Number);
    const base = new Date();
    base.setHours(h || 0, m || 0, 0, 0);
    base.setMinutes(
      base.getMinutes() + (Number.isFinite(minutes) ? minutes : 0)
    );
    const hh = String(base.getHours()).padStart(2, "0");
    const mm2 = String(base.getMinutes()).padStart(2, "0");
    return `${hh}:${mm2}`;
  }
  private async toast(
    message: string,
    color: "success" | "danger" | "primary" = "success"
  ) {
    const t = await this._toastCtrl.create({ message, duration: 2200, color });
    await t.present();
  }
}
