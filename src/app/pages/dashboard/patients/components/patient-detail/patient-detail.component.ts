import { Component, OnInit } from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { IonicModule } from '@ionic/angular';
import { ActivatedRoute, RouterModule } from '@angular/router';

registerLocaleData(localeEs);

type Status = 'Agendada' | 'Completada' | 'Cancelada';

interface Appointment {
  id: string;
  date: string | Date;  
  start: string;       
  end: string;          
  type: string;        
  status: Status;
}

interface PatientDetail {
  id: string;
  nombre: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  appointments: Appointment[];
}

@Component({
  selector: 'app-patient-detail',
  standalone: true,
  templateUrl: './patient-detail.component.html',
  styleUrls: ['./patient-detail.component.scss'],
  imports: [IonicModule, CommonModule, RouterModule],
})
export class PatientDetailComponent implements OnInit {
  patient!: PatientDetail;

  
  statusClassMap: Record<Status, string> = {
    Agendada:   'status status--agendada',
    Completada: 'status status--completada',
    Cancelada:  'status status--cancelada',
  };

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';

    
    const map: Record<string, PatientDetail> = {
      P001: DEMO_PATIENT_1,
      P002: DEMO_PATIENT_2,
    };
    this.patient = map[id] ?? DEMO_PATIENT_1;
  }

  back() { history.back(); }
  onMore() { console.log('Más acciones'); }
  openAppointment(a: Appointment) { console.log('Abrir cita', a.id); }
  trackByAppt(_: number, a: Appointment) { return a.id; }
}


const DEMO_PATIENT_1: PatientDetail = {
  id: 'P001',
  nombre: 'Juan Pérez',
  email: 'juan.perez@example.com',
  telefono: '555-1234',
  direccion: 'Av. Siempre Viva 123, Ciudad',
  appointments: [
    { id: '#B002', date: '2024-10-18', start: '9:00 am',  end: '10:00 am', type: 'Consulta Especializada', status: 'Agendada' },
    { id: '#B003', date: '2024-10-18', start: '9:00 am',  end: '10:00 am', type: 'Consulta General',       status: 'Agendada' },
    { id: '#B004', date: '2024-10-18', start: '9:00 am',  end: '10:00 am', type: 'Consulta Especializada', status: 'Completada' },
  ],
};

const DEMO_PATIENT_2: PatientDetail = {
  id: 'P002',
  nombre: 'Enrique Flores Gonzales',
  email: 'enrique@example.com',
  telefono: '301-321-3212',
  direccion: 'Cra. 45 #10-23, Bogotá',
  appointments: [
    { id: '#B101', date: '2024-11-02', start: '10:15 am', end: '10:45 am', type: 'Consulta General',       status: 'Agendada' },
    { id: '#B087', date: '2024-10-25', start: '4:00 pm',  end: '4:30 pm',  type: 'Consulta Especializada', status: 'Completada' },
    { id: '#B065', date: '2024-10-12', start: '9:05 am',  end: '9:35 am',  type: 'Consulta General',       status: 'Cancelada' },
  ],
};

