import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';

@Component({
  selector: 'date-picker-modal',
  standalone: true,
  imports: [IonicModule, CommonModule],
  template: `
  <ion-header translucent="true">
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button fill="clear" (click)="cancel()">
          <ion-icon slot="icon-only" name="close-outline"></ion-icon>
        </ion-button>
      </ion-buttons>
      <ion-title>Fecha</ion-title>
      <ion-buttons slot="end">
        <ion-button fill="clear" (click)="confirm()">
          <ion-icon slot="icon-only" name="checkmark-outline"></ion-icon>
        </ion-button>
      </ion-buttons>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-datetime
      presentation="date"
      [value]="selected"
      [min]="min ?? undefined"
      [locale]="locale"
      firstDayOfWeek="1"
      [showDefaultButtons]="false"
      (ionChange)="onChange($event.detail.value)">
    </ion-datetime>
  </ion-content>
  `
})
export class DatePickerModalComponent {
  @Input() value?: string | null;
  @Input() min?: string | null;
  @Input() locale: string = 'es-ES';

  selected!: string;

  constructor(private modalCtrl: ModalController) {}

  ngOnInit() {
    this.selected = this.value ?? new Date().toISOString();
  }

  onChange(val: string | string[] | null | undefined) {
    const iso = Array.isArray(val) ? (val[0] ?? null) : (val ?? null);
    if (iso) this.selected = iso;
  }

  cancel() { this.modalCtrl.dismiss(null, 'cancel'); }
  confirm() { this.modalCtrl.dismiss(this.selected, 'confirm'); }
}
