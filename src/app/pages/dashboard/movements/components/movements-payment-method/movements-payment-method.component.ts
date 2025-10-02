import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { DatePickerModalComponent } from '../movements-payment-method/date-picker/date-picker.component';

type Frequency = 'semanal' | 'quincenal' | 'mensual';
type PayType = 'contado' | 'credito';

@Component({
  selector: 'movements-payment-method',
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule],
  templateUrl: './movements-payment-method.component.html',
  styleUrls: ['./movements-payment-method.component.scss'],
})
export class MovementsPaymentMethodComponent implements OnInit {
  @Input() currencyCode: string = 'USD';

  @Input() set totalAmount(v: number) {
    this._total = Number(v || 0);
    if (this.form) this.onRecalc();
  }
  get totalAmount(): number { return this._total; }
  private _total = 0;

  /** Default: 1 cuota, semanal, hoy */
  @Input() initial: {
    paymentType: PayType;
    installments: number;
    frequency: Frequency;
    startDate: string; // ISO
  } = {
    paymentType: 'credito',
    installments: 1,
    frequency: 'semanal',
    startDate: new Date().toISOString(),
  };

  @Output() saved = new EventEmitter<any>();

  form!: FormGroup;

  perInstallment = 0;               
  summaryRows: Date[] = [];         
  summaryLabels: string[] = [];     
  startDateLabel = '';              

  installmentAmounts: number[] = []; 
  readonly minDateIso = new Date().toISOString();

  get isContado(): boolean { return this.form?.value?.paymentType === 'contado'; }

  constructor(private fb: FormBuilder, private modalCtrl: ModalController) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      paymentType: [this.initial.paymentType, Validators.required],
      installments: [this.initial.installments, [Validators.required, Validators.min(1)]],
      frequency: [this.initial.frequency, Validators.required],
      startDate: [this.initial.startDate, Validators.required],
    });
    this.onRecalc();
  }

  // ========= Handlers =========
  onPaymentTypeChange(): void {
    const type: PayType = this.form.get('paymentType')!.value;
    if (type === 'contado') {
      this.form.patchValue({
        installments: 1,
        frequency: 'semanal',
        startDate: new Date().toISOString(),
      }, { emitEvent: false });
    }
    this.onRecalc();
  }

  onInstallmentsInput(ev: any): void {
    const raw = ev?.detail?.value ?? ev?.target?.value ?? '';
    const digits = String(raw).replace(/\D+/g, '');
    let n = parseInt(digits || '1', 10);
    if (!Number.isFinite(n) || n < 1) n = 1;
    if (n > 120) n = 120;
    const ctrl = this.form.get('installments')!;
    if (ctrl.value !== n) ctrl.setValue(n, { emitEvent: false });
    this.onRecalc();
  }

  onFrequencyChange(): void { this.onRecalc(); }

  async openStartDateModal() {
    const modal = await this.modalCtrl.create({
      component: DatePickerModalComponent,
      componentProps: {
        value: this.form.get('startDate')!.value,
        min: this.minDateIso,
        locale: 'es-ES',
      },
      breakpoints: [0, 0.9],
      initialBreakpoint: 0.9,
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm' && data) {
      this.form.get('startDate')!.setValue(data as string, { emitEvent: false });
      this.onRecalc();
    }
  }
  // ============================

  dismiss() { try { this.modalCtrl.dismiss(null, 'cancel'); } catch {} }

  async save() {
    if (!this.form.valid) return;
    const payload = {
      ...this.form.getRawValue(),
      totalAmount: this.totalAmount,
      perInstallment: this.perInstallment,
      schedule: this.summaryRows,       // fechas (Date[])
      amounts: this.installmentAmounts, // montos por cuota
    };
    try { await this.modalCtrl.dismiss(payload, 'saved'); }
    catch { this.saved.emit(payload); }
  }

  labelCuotas(n: number) { n = Number(n || 1); return `${n} ${n === 1 ? 'cuota' : 'cuotas'}`; }
  trackByIndex = (i: number) => i;

  // ========= Cálculos =========
  onRecalc(): void {
    const { paymentType, installments, frequency, startDate } = this.form.getRawValue();
    const n = Math.max(1, Math.floor(Number(installments ?? 1)));
    const start = new Date(startDate || new Date().toISOString());

    // Etiqueta del campo de inicio
    this.startDateLabel = this.formatDateEs(start, false);

    // Fechas exactas (N) y etiquetas con día de la semana
    this.summaryRows = this.buildSchedule(n, (frequency as Frequency) ?? 'semanal', start);
    this.summaryLabels = this.summaryRows.map(d => this.formatDateEs(d, true));

    // Montos (centavos; última ajusta)
    if (paymentType === 'contado' || n === 1) {
      const one = this.round2(this.totalAmount);
      this.installmentAmounts = [one];
      this.perInstallment = one;
    } else {
      this.installmentAmounts = this.splitIntoInstallmentsCents(this.totalAmount, n);
      this.perInstallment = this.installmentAmounts[0] ?? this.round2(this.totalAmount / n);
    }
  }

  private buildSchedule(n: number, frequency: Frequency, start: Date): Date[] {
    const out: Date[] = [];
    let cur = new Date(start);
    for (let i = 0; i < n; i++) {
      out.push(new Date(cur));
      cur = this.addByFrequency(cur, frequency);
    }
    return out;
  }
  private addByFrequency(d: Date, f: Frequency): Date {
    if (f === 'semanal') return this.addDays(d, 7);
    if (f === 'quincenal') return this.addDays(d, 14);
    return this.addMonthsSafe(d, 1);
  }
  private addDays(d: Date, days: number): Date { const x = new Date(d); x.setDate(x.getDate() + days); return x; }
  private addMonthsSafe(d: Date, months: number): Date {
    const y = d.getFullYear(); const m = d.getMonth() + months; const day = d.getDate();
    const target = new Date(y, m, 1); const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(day, last)); return target;
  }

  /** Reparte en centavos; la última ajusta para cuadrar exacto */
  private splitIntoInstallmentsCents(total: number, n: number): number[] {
    const cents = Math.round((Number(total) || 0) * 100);
    if (n <= 1) return [cents / 100];
    const base = Math.floor(cents / n);
    const arr = Array(n).fill(base);
    arr[n - 1] = cents - base * (n - 1);
    return arr.map(c => Math.round(c) / 100);
  }

  // ======= Formato ES (sin DatePipe) =======
  private formatDateEs(d: Date, withWeekday: boolean): string {
    const parts = new Intl.DateTimeFormat('es-ES', {
      weekday: withWeekday ? 'short' : undefined,
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).formatToParts(d);
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
    const wd = get('weekday')?.replace('.', '') || '';
    const day = get('day');
    const month = get('month')?.replace('.', '') || '';
    const year = get('year');
    return withWeekday
      ? `${wd} ${day} de ${month}, ${year}`
      : `${day} de ${month}, ${year}`;
  }

  private round2(v: number): number { return Math.round((v + Number.EPSILON) * 100) / 100; }
}
