// src/app/pages/dashboard/appointments/components/appointment-management/appointment-management.component.ts
import { CommonModule, registerLocaleData } from "@angular/common";
import localeEs from "@angular/common/locales/es";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { IonicModule, MenuController } from "@ionic/angular";
import { Router } from "@angular/router";

import {
  AppointmentsService,
  AppointmentApi,
  CitaEstado,
} from "src/app/core/services/bussiness/appointment.service";

registerLocaleData(localeEs);

type Status = "Agendada" | "Completada" | "Cancelada";
type Origen = "whatsapp" | "app" | "web" | "tel";

export interface AppointmentUI {
  id: string;
  paciente: string;
  date: Date | null;
  start: string;
  end: string;
  type: string;
  status: Status;
  origen?: Origen;
  telefono?: string;
  updatedAt?: Date | null;
}

@Component({
  selector: "app-appointment-management",
  standalone: true,
  templateUrl: "./appointment-management.component.html",
  styleUrls: ["./appointment-management.component.scss"],
  imports: [IonicModule, CommonModule, FormsModule, RouterModule],
})
export class AppointmentManagementComponent implements OnInit {
  constructor(
    private menuCtrl: MenuController,
    private appointmentsSrv: AppointmentsService,
    private router: Router
  ) {}


  loading = false;
  error?: string;


  query = "";
  activeFilter: string | null = null;

  appointments: AppointmentUI[] = [];
  filtered: AppointmentUI[] = [];
  grouped: { label: string; items: AppointmentUI[] }[] = [];

  statusOptions: Status[] = ["Agendada", "Completada", "Cancelada"];
  origenOptions: Origen[] = ["whatsapp", "app", "web", "tel"];
  updatedDateOptions = [
    { label: "Hoy", value: "hoy" as const },
    { label: "Últimos 7 días", value: "7d" as const },
    { label: "Últimos 30 días", value: "30d" as const },
    { label: "Todo", value: "todo" as const },
  ];


  selectedStatuses = new Set<Status>();
  selectedOrigen = new Set<Origen>();
  dateFilter: "hoy" | "7d" | "30d" | "todo" = "todo";


  public statusClassMap: Record<Status, string> = {
    Agendada: "status--agendada",
    Completada: "status--completada",
    Cancelada: "status--cancelada",
  };


  skeletons = Array.from({ length: 5 });

  ngOnInit(): void {
    this.load();
  }

  async load(ev?: CustomEvent) {
    this.loading = true;
    this.error = undefined;
    try {
      const rows = await this.appointmentsSrv.getAll();
      this.appointments = rows.map(this.toUI);
      this.applyFilter();
    } catch (e: any) {
      this.error = e?.message || "No se pudieron cargar las citas";
    } finally {
      this.loading = false;
      (ev?.target as HTMLIonRefresherElement)?.complete?.();
    }
  }

  onCreate(): void {
    this.router.navigate(["/dashboard/appointments/upsert-appointment"]);
  }
  onAdd(): void {
    this.onCreate();
  }

 
  private toUI = (a: AppointmentApi): AppointmentUI => {
    const status = this.mapStatus(a.estado);

 
    const start = ((a.hora_inicio ?? "").match(/^\d{2}:\d{2}/)?.[0] ?? "00:00");
    const end   = ((a.hora_fin ?? "").match(/^\d{2}:\d{2}/)?.[0] ?? "00:00");

    
    const date =
      this.safeDateFromParts(a.fecha, start) ??
      this.safeDate(a.fecha) ??
      null;

    const updatedAt = this.safeDate(a.updated_at);

    return {
      id: a.id,
      paciente: a.cliente_nombre ?? `Cliente ${a.cliente_id}`,
      date,
      start,
      end,
      type: a.servicio_nombre ?? "",
      status,
      origen: (a.origen as Origen) ?? undefined,
      telefono: a.telefono,
      updatedAt,
    };
  };

  private mapStatus(s: CitaEstado): Status {
    const k = String(s || "").toLowerCase();
    if (k.includes("cancel")) return "Cancelada";
    if (k.includes("complet")) return "Completada";
    return "Agendada";
  }


  openFilters()  { this.menuCtrl.open("filters"); }
  closeFilters() { this.menuCtrl.close("filters"); }

  resetFilters() {
    this.selectedStatuses.clear();
    this.selectedOrigen.clear();
    this.dateFilter = "todo";
    this.applyFilter();
  }
  applyAndClose() {
    this.applyFilter();
    this.closeFilters();
  }

  
  applyFilter() {
    const q = this.query.trim().toLowerCase();

    let out = !q
      ? [...this.appointments]
      : this.appointments.filter(
          (a) =>
            a.id.toLowerCase().includes(q) ||
            (a.paciente || "").toLowerCase().includes(q) ||
            (a.type || "").toLowerCase().includes(q)
        );

    if (this.selectedStatuses.size) {
      out = out.filter((a) => this.selectedStatuses.has(a.status));
    }
    if (this.selectedOrigen.size) {
      out = out.filter((a) => a.origen && this.selectedOrigen.has(a.origen));
    }

    if (this.dateFilter !== "todo") {
      const today = this.startOfDay(new Date());
      let from = new Date(today);
      if (this.dateFilter === "hoy")  from = today;
      if (this.dateFilter === "7d")   from.setDate(today.getDate() - 7);
      if (this.dateFilter === "30d")  from.setDate(today.getDate() - 30);

      out = out.filter((a) => {
        const ref = a.updatedAt ?? a.date; 
        if (!ref) return false;
        return this.startOfDay(ref).getTime() >= from.getTime();
      });
    }

    this.filtered = out;
    this.grouped = this.groupByDay(this.filtered);
    this.activeFilter = this.buildActiveFilterLabel();
  }

  private buildActiveFilterLabel(): string | null {
    const parts: string[] = [];
    if (this.selectedStatuses.size)
      parts.push(Array.from(this.selectedStatuses).join(", "));
    if (this.selectedOrigen.size)
      parts.push(Array.from(this.selectedOrigen).join(", "));
    if (this.dateFilter !== "todo") {
      const label = this.updatedDateOptions.find((o) => o.value === this.dateFilter)?.label;
      if (label) parts.push(label);
    }
    return parts.length ? parts.join(" • ") : null;
  }

  toggleStatus(s: Status, checked: boolean) {
    checked ? this.selectedStatuses.add(s) : this.selectedStatuses.delete(s);
  }
  toggleOrigen(o: Origen, checked: boolean) {
    checked ? this.selectedOrigen.add(o) : this.selectedOrigen.delete(o);
  }

  clearSearch() { this.query = ""; this.applyFilter(); }
  clearFilter() { this.resetFilters(); }


  open(a: AppointmentUI) {
    console.log("Abrir cita", a);
  }

  openWhatsApp(a: AppointmentUI, ev?: Event) {
    ev?.stopPropagation();
    if (!a.telefono) return;
    const phone = a.telefono.replace(/\D/g, "");
    const msg = `Hola ${a.paciente}, sobre tu cita ${a.id}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  trackById(_: number, a: AppointmentUI) { return a.id; }


  private safeDate(x?: string | Date | null): Date | null {
    if (!x) return null;
    if (x instanceof Date) return isNaN(x.getTime()) ? null : x;
    const s = String(x).trim();
    if (!s) return null;
    const d = new Date(s.includes("T") ? s : s.replace(" ", "T"));
    return isNaN(d.getTime()) ? null : d;
  }
  private safeDateFromParts(fecha?: string, hora?: string): Date | null {
    const f = (fecha || "").trim();
    if (!f) return null;
    const hhmm = (hora || "00:00").slice(0, 5);
    const d = new Date(`${f}T${hhmm}:00`);
    return isNaN(d.getTime()) ? null : d;
  }
  private startOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  private formatHeader(d: Date): string {
    const today = new Date();
    const diffMs = this.startOfDay(today).getTime() - this.startOfDay(d).getTime();
    const one = 24 * 60 * 60 * 1000;
    if (diffMs === 0) return "Hoy";
    if (diffMs === one) return "Ayer";
    return new Intl.DateTimeFormat("es-CO", { weekday: "long" })
      .format(d)
      .replace(/^\w/, (c) => c.toUpperCase());
  }

  private groupByDay(items: AppointmentUI[]) {
    const map = new Map<string, AppointmentUI[]>();
    const noDate: AppointmentUI[] = [];

    for (const a of items) {
      if (!a.date) { noDate.push(a); continue; }
      const key = this.startOfDay(a.date).toISOString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }

    const entries = Array.from(map.entries()).sort(
      (a, b) => +new Date(b[0]) - +new Date(a[0])
    );

    const groups = entries.map(([key, arr]) => ({
      label: this.formatHeader(new Date(key)),
      items: arr.sort((x, y) => x.start.localeCompare(y.start)),
    }));

    if (noDate.length) {
      groups.push({ label: "Sin fecha", items: noDate });
    }

    return groups;
  }
}
