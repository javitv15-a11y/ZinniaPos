import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';

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
  /** Moneda para el pipe currency (forzamos USD aquí) */
  @Input() currencyCode: string = 'USD';

  /** Total de la compra: llega desde el padre */
  @Input() set totalAmount(v: number) {
    this._total = Number(v || 0);
    if (this.form) this.onRecalc();
  }
  get totalAmount(): number { return this._total; }
  private _total = 0;

  @Input() initial: {
    paymentType: PayType;
    installments: number;
    frequency: Frequency;
    startDate: string;        // ISO
  } = {
    paymentType: 'credito',
    installments: 3,
    frequency: 'semanal',
    startDate: new Date().toISOString(),
  };

  @Output() saved = new EventEmitter<any>();

  form!: FormGroup;
  perInstallment = 0;
  summaryRows: Date[] = [];

  get isContado(): boolean {
    return this.form?.value.paymentType === 'contado';
  }

  constructor(
    private fb: FormBuilder,
    private modalCtrl: ModalController
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      paymentType: [this.initial.paymentType, Validators.required],
      installments: [this.initial.installments, [Validators.required, Validators.min(1)]],
      frequency: [this.initial.frequency, Validators.required],
      startDate: [this.initial.startDate, Validators.required],
    });

    this.form.get('paymentType')!.valueChanges.subscribe((type: PayType) => {
      if (type === 'contado') {
        this.form.patchValue(
          { installments: 1, frequency: 'semanal', startDate: new Date().toISOString() },
          { emitEvent: false }
        );
      }
      this.onRecalc();
    });

    this.onRecalc();
  }

  dismiss() {
    try { this.modalCtrl.dismiss(null, 'cancel'); } catch {}
  }

  async save() {
    if (!this.form.valid) return;
    const payload = {
      ...this.form.value,
      totalAmount: this.totalAmount,
      perInstallment: this.perInstallment,
      schedule: this.summaryRows,
    };
    try { await this.modalCtrl.dismiss(payload, 'saved'); }
    catch { this.saved.emit(payload); }
  }

  onRecalc(): void {
    const { paymentType, installments, frequency, startDate } = this.form.value;

    if (paymentType === 'contado') {
      this.perInstallment = this.totalAmount;
      this.summaryRows = [new Date(startDate)];
      return;
    }

    const n = Math.max(1, Number(installments || 1));
    this.perInstallment = this.round2(this.totalAmount / n);
    this.summaryRows = this.buildSchedule(n, frequency as Frequency, new Date(startDate));
  }

  private buildSchedule(n: number, frequency: Frequency, start: Date): Date[] {
    const rows: Date[] = [];
    let cur = new Date(start);
    for (let i = 0; i < n; i++) {
      rows.push(new Date(cur));
      cur = this.addByFrequency(cur, frequency);
    }
    return rows;
  }

  private addByFrequency(d: Date, f: Frequency): Date {
    const x = new Date(d);
    if (f === 'semanal') x.setDate(x.getDate() + 7);
    if (f === 'quincenal') x.setDate(x.getDate() + 14);
    if (f === 'mensual') {
      const m = x.getMonth();
      x.setMonth(m + 1);
      if (x.getMonth() === (m + 2) % 12) x.setDate(0); // ajuste meses cortos
    }
    return x;
  }

  private round2(v: number): number {
    return Math.round((v + Number.EPSILON) * 100) / 100;
  }
}
