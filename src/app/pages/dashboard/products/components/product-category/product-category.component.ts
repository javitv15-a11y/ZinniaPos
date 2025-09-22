import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { RouterModule } from '@angular/router';

import { HeaderComponent } from 'src/app/shared/components/header/header.component';
import { settingHeader } from './product-category.consts';

import { Subscription } from 'rxjs';
import { ProductCategoryService, CreateCategoriaDto } from 'src/app/core/services/bussiness/product-category.service';

@Component({
  selector: 'app-product-category',
  standalone: true,
  templateUrl: './product-category.component.html',
  styleUrls: ['./product-category.component.scss'],
  imports: [
    CommonModule,
    IonicModule,
    HeaderComponent,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
  ],
})
export class ProductCategoryComponent implements OnDestroy {
  public settingHeader = { ...settingHeader, rightDisabled: true };
  public categoryForm!: FormGroup;
  public saving = false;

  private sub?: Subscription;

  constructor(
    private fb: FormBuilder,
    private modalCtrl: ModalController,
    private categoryService: ProductCategoryService,
    private toastCtrl: ToastController
  ) {}

  ionViewWillEnter() {
    this.buildForm();
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  private buildForm(): void {
    this.categoryForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
      
      tax: [
        '',
        [
          Validators.required,
          Validators.pattern(/^\d+([.,]\d{1,2})?$/),
          Validators.min(0),
          Validators.max(100),
        ],
      ],
    });

    
    this.sub = this.categoryForm.statusChanges.subscribe(() => {
      this.settingHeader = {
        ...this.settingHeader,
        rightDisabled: this.categoryForm.invalid || this.saving,
      };
    });
  }

  public onSubmit(): void {
    this.save();
  }

  private parseTax(value: unknown): number {
    const n = Number(String(value ?? '').replace(',', '.'));
    if (Number.isNaN(n)) return 0;
    return Math.min(100, Math.max(0, Math.round(n * 100) / 100));
  }

  public async save(): Promise<void> {
    if (!this.categoryForm || this.categoryForm.invalid || this.saving) {
      this.categoryForm?.markAllAsTouched();
      (await this.toastCtrl.create({
        message: 'Completa los campos requeridos',
        duration: 1200,
        position: 'bottom',
      })).present();
      return;
    }

    this.saving = true;
    this.settingHeader = { ...this.settingHeader, rightDisabled: true };

    try {
      const f = this.categoryForm.getRawValue();
      const dto: CreateCategoriaDto = {
        nombre: String(f.name).trim(),
        impuesto: this.parseTax(f.tax),
      };

      const { ok } = await this.categoryService.createCategoria(dto);
      if (ok) {
        (await this.toastCtrl.create({
          message: 'Categoría creada',
          duration: 1400,
          position: 'bottom',
        })).present();
        this.modalCtrl.dismiss({ completed: true, category: dto });
      } else {
        throw new Error('El servidor no confirmó el registro');
      }
    } catch (e: any) {
      (await this.toastCtrl.create({
        message: e?.message || 'No se pudo crear la categoría',
        duration: 1600,
        color: 'danger',
        position: 'bottom',
      })).present();
    } finally {
      this.saving = false;
      this.settingHeader = {
        ...this.settingHeader,
        rightDisabled: this.categoryForm.invalid,
      };
    }
  }

  public close() { this.modalCtrl.dismiss(); }
}
