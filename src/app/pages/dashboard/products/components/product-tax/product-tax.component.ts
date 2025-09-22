import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from 'src/app/shared/components/header/header.component';
import { settingHeader } from './product-tax.const';
import { TaxService } from 'src/app/core/services/bussiness/tax.service';

type TaxType = 'included' | 'added';

@Component({
  selector: 'app-product-tax',
  standalone: true,
  templateUrl: './product-tax.component.html',
  styleUrls: ['./product-tax.component.scss'],
  imports: [
    CommonModule,
    IonicModule,
    HeaderComponent,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
  ],
})
export class ProductTaxComponent {
  public settingHeader = settingHeader;

  public taxForm!: FormGroup;
  public saving = false;

  isTypeSheetOpen = false;
  tempType: TaxType = 'included';

  constructor(
    private fb: FormBuilder,
    private modalCtrl: ModalController,
    private taxService: TaxService,
  ) {}

  ionViewWillEnter() {
    this.buildForm();
  }

  private buildForm() {
    this.taxForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      rate: [19, [Validators.required, Validators.min(0), Validators.max(100)]],
      type: ['included' as TaxType, Validators.required],
    });
  }


  get typeLabel(): string {
    const v = this.taxForm?.get('type')?.value as TaxType;
    return v === 'included' ? 'Impuesto incluido en el precio' : 'Impuesto agregado al precio';
    }


  openTypeSheet() {
    this.tempType = this.taxForm.get('type')!.value as TaxType;
    this.isTypeSheetOpen = true;
  }
  closeTypeSheet() { this.isTypeSheetOpen = false; }
  applyTypeSheet() {
    this.taxForm.get('type')!.setValue(this.tempType);
    this.closeTypeSheet();
  }

  onSubmit() {
    if (!this.taxForm || this.taxForm.invalid || this.saving) return;

    this.saving = true;
    const payload = this.taxForm.value; 

    this.taxService.saveTax(payload).subscribe({
      next: (ok: boolean) => {
        this.saving = false;
        if (ok) this.modalCtrl.dismiss({ completed: true, tax: payload });
      },
      error: (err) => {
        console.error(err);
        this.saving = false;
      },
    });
  }
}
