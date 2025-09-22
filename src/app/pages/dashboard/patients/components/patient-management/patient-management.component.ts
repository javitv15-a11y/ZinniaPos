// src/app/pages/dashboard/patients/components/patient-management/patient-management.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ClientesService, ClienteApi } from 'src/app/core/services/bussiness/clientes.service';
import { AppointmentsService, AppointmentApi } from 'src/app/core/services/bussiness/appointment.service';
import { ProductCustomerComponent } from 'src/app/pages/dashboard/products/components/product-customer/product-customer.component';

interface PacienteUI extends Omit<ClienteApi, 'correo' | 'telefono'> {
  correo?: string;
  telefono?: string;
  fechaRegistroDate?: Date;
  citasCount: number;
  ultimaCitaDate: Date | null;
}

@Component({
  selector: 'app-patient-management',
  standalone: true,
  templateUrl: './patient-management.component.html',
  styleUrls: ['./patient-management.component.scss'],
  imports: [CommonModule, IonicModule, HttpClientModule, FormsModule, RouterModule],
})
export class PatientManagementComponent implements OnInit {
  loading = false;
  error?: string;

  pacientes: PacienteUI[] = [];
  filtered: PacienteUI[] = [];
  query = '';

  constructor(
    private clientesSrv: ClientesService,
    private apptSrv: AppointmentsService,
    private modalCtrl: ModalController
  ) {}

  ngOnInit() {
    this.load();
  }

  async load(ev?: CustomEvent) {
    this.loading = true;
    this.error = undefined;
    try {
      const raw = await this.clientesSrv.getClientes();
      this.pacientes = (raw ?? []).map(this.mapPacienteBase);
      this.applyFilter();

      const citas = await this.apptSrv.getAllSafe();
      const resume = this.buildResumeFromAppointments(citas);

      
      this.pacientes = this.pacientes.map(p => {
        const r = resume[this.getId(p)] ?? { count: 0, last: null };
        return { ...p, citasCount: r.count, ultimaCitaDate: r.last };
      });
      this.applyFilter();
    } catch (e: any) {
      this.error = e?.message || 'No se pudo cargar pacientes.';
      this.pacientes = [];
      this.filtered = [];
    } finally {
      this.loading = false;
      (ev?.target as HTMLIonRefresherElement)?.complete?.();
    }
  }

  
  private mapPacienteBase = (c: ClienteApi): PacienteUI => {
    const correo = String((c as any).correo ?? (c as any).email ?? '').trim();
    const telefono = String((c as any).telefono ?? (c as any).phone ?? (c as any).celular ?? '').trim();
    const isoReg = (c as any).fecha_registro?.toString()?.replace?.(' ', 'T');
    const fr = isoReg ? new Date(isoReg) : undefined;

    return {
      ...(c as any),
      correo: correo || undefined,
      telefono: telefono || undefined,
      fechaRegistroDate: fr && !Number.isNaN(fr.getTime()) ? fr : undefined,
      citasCount: 0,
      ultimaCitaDate: null,
    };
  };

 
  private buildResumeFromAppointments(appts: AppointmentApi[]) {
    const out: Record<string, { count: number; last: Date | null }> = {};
    for (const a of appts || []) {
      const id = String(a.cliente_id || '');
      if (!id) continue;
      const d = this.combineDateTime(a.fecha, a.hora_inicio);
      if (!out[id]) out[id] = { count: 0, last: null };
      out[id].count += 1;
      if (d && (!out[id].last || d.getTime() > out[id].last!.getTime())) out[id].last = d;
    }
    return out;
    }

  private combineDateTime(fecha?: string, hora?: string): Date | null {
    const f = (fecha || '').trim();
    const h = (hora || '00:00:00').trim();
    if (!f) return null;
    const d = new Date(`${f}T${h}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }


  applyFilter() {
    const q = this.query.trim().toLowerCase();
    if (!q) {
      this.filtered = [...this.pacientes];
      return;
    }
    this.filtered = this.pacientes.filter((p) => {
      const nombre = (p as any).nombre?.toLowerCase?.() ?? '';
      const correo = (p.correo ?? '').toLowerCase();
      const telefono = (p.telefono ?? '').toLowerCase();
      const direccion = ((p as any).direccion ?? '').toLowerCase();
      return nombre.includes(q) || correo.includes(q) || telefono.includes(q) || direccion.includes(q);
    });
    this.filtered = [...this.filtered];
  }

  clearSearch() {
    this.query = '';
    this.applyFilter();
  }


  getId(c: any) {
    return String(c?.id ?? c?.cliente_id ?? c?._id ?? '').trim();
  }
  getCitasLabel(p: PacienteUI) {
    const n = Number(p.citasCount ?? 0);
    return `${n} ${n === 1 ? 'Cita' : 'Citas'}`;
  }
  displaySub(p: PacienteUI) {
    return [p.correo, p.telefono].filter(Boolean).join(' • ');
  }
  trackById = (_: number, p: PacienteUI) => this.getId(p) || _;


  async onAdd() {
    const modal = await this.modalCtrl.create({
      component: ProductCustomerComponent,
      cssClass: 'option-select-modal',
      breakpoints: [0, 1],
      initialBreakpoint: 1,
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    if (data?.completed) this.load();
  }
}
