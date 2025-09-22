import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from 'src/app/shared/components/header/header.component';
import { settingHeader } from './product-supplier.const';
import { SupplierService } from 'src/app/core/services/bussiness/supplier.service';

@Component({
  selector: 'app-product-supplier', 
  standalone: true,
  templateUrl: './product-supplier.component.html',
  styleUrls: ['./product-supplier.component.scss'],
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
  public supplierForm!: FormGroup;
  public saving = false;

  constructor(
    private fb: FormBuilder,
    private modalCtrl: ModalController,
    private suppliersService: SupplierService, 
  ) {}

  ionViewWillEnter() {
    this.buildForm();
  }

  private buildForm(): void {
    this.supplierForm = this.fb.group({
      name:    ['', [Validators.required, Validators.minLength(2)]],
      phone:   ['', [Validators.required]],
      email:   ['', [Validators.required, Validators.email]],
      address: ['', [Validators.required]],
    });
  }

  public onSubmit() {
    if (!this.supplierForm || this.supplierForm.invalid || this.saving) return;

    this.saving = true;
    const payload = this.supplierForm.value;

    this.suppliersService.saveSupplier(payload).subscribe({
      next: (ok: boolean) => {
        this.saving = false;
        if (ok) {
          this.modalCtrl.dismiss({ completed: true, supplier: payload });
        }
      },
      error: (err) => {
        console.error(err);
        this.saving = false;
      }
    });
  }
}
