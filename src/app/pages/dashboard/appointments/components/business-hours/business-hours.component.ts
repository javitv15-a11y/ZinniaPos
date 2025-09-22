import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronForwardOutline, trash, trashOutline } from 'ionicons/icons';
import { DirectivesModule } from 'src/app/core/directives/directives.module';
import { HeaderComponent } from 'src/app/shared/components/header/header.component';
import { dayServiceOptions, serviceDaysConfig, settingHeader, ValueServiceDaysOptions, WEEK_DAYS } from './bussiness-hours';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CustomInputComponent } from 'src/app/shared/components/custom-input/custom-input.component';
import { UpsertAppointmentTypeComponent } from '../upsert-appointment-type/upsert-appointment-type.component';
import { OpenSelectOptionsService } from 'src/app/core/services/utils/open-select-options.service';
import { TimeInterval } from 'src/app/core/interfaces/time-interval.interface';
import { TimePickerModalComponent } from 'src/app/shared/components/time-picker-modal/time-picker-modal.component';
import { consultationTypeConfig, mapObjectToSelectOptions } from '../../appointments.consts';
import { AppointmentTypeService } from 'src/app/core/services/bussiness/appointment-type.service';
import { ISelectModalConfig, ISelectOption } from 'src/app/core/interfaces/select-options-modal.interface';
import { IAppointmentType } from 'src/app/core/interfaces/bussiness/appointments-type.interface';

@Component({
  selector: 'app-business-hours',
  templateUrl: './business-hours.component.html',
  styleUrls: ['./business-hours.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    HeaderComponent,
    DirectivesModule,
    ReactiveFormsModule,
  ],
})
export class BusinessHoursComponent implements OnInit {

  public loading = true;
  public weekDays = WEEK_DAYS;
  public settingHeader = settingHeader;
  public typeAppointmentsForm!: FormGroup;
  public daysOfServiceForm!: FormGroup;
  public ValueServiceDaysOptions = ValueServiceDaysOptions;
  public intervals: TimeInterval[] = [
    { from: '07:00', to: '09:00' },
    { from: '10:00', to: '11:00' }
  ];
  private _appointmentTypes: IAppointmentType[] = [];
  private consultationTypeConfig: ISelectModalConfig = consultationTypeConfig;
  
  constructor(
    private _formBuilder: FormBuilder,
    private _modalCtrl: ModalController,
    private _appointmentTypesService: AppointmentTypeService,
    private _openSelectOptionsService: OpenSelectOptionsService,
  ) {
    addIcons({
      trash,
      chevronForwardOutline,
      trashOutline,
    });
    this.buildConsultationForm();
    this.buildDaysOfServiceForm();
  }

  ngOnInit() {
    this.getAppointmentTypes();
  }

  public getAppointmentTypeLabel(): string {
    const value = this.typeAppointmentsForm.get('appointmentType')?.value;
    const option = this._appointmentTypes.find(opt => opt.id === value);
    return option?.name || '';
  }

  public async selectAppointmentType() {
    const data = await this._openSelectOptionsService.open({ ...consultationTypeConfig });

    if (data) {
      this.typeAppointmentsForm.get('appointmentType')?.setValue(data.value);
    }
  }

  public getApplyToLabel(): string {
    const value = this.daysOfServiceForm.get('applyTo')?.value;
    const option = dayServiceOptions.find(opt => opt.value === value);
    return option?.title || '';
  }

  public async selectApplyTo() {
    const data = await this._openSelectOptionsService.open({
      ...serviceDaysConfig
    });

    if (data) {
      this.daysOfServiceForm.get('applyTo')?.setValue(data.value);
    }
  }

  public async goToUpsertAppointmentType() {
    const modal = await this._modalCtrl.create({
      component: UpsertAppointmentTypeComponent
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
  }

  public actionCompleted() {
    const data = { completed: true };
    this._modalCtrl.dismiss(data);
  }

  public getSelectedDays(): string[] {
    return this.daysOfServiceForm.value.daysOfService;
  }

  public isSelected(day: string): boolean {
    return this.daysOfServiceForm.value.daysOfService?.includes(day) ?? false;
  }

  public onToggleDay(day: string, checked: boolean): void {
    const selected = this.daysOfServiceForm.value.daysOfService as string[];
    if (checked && !selected.includes(day)) {
      this.daysOfServiceForm.patchValue({ daysOfService: [...selected, day] });
    } else if (!checked) {
      this.daysOfServiceForm.patchValue({ daysOfService: selected.filter(d => d !== day) });
    }
  }

  public addInterval() {
    this.intervals.push({ from: '08:00', to: '09:00' });
  }

  public removeInterval(index: number) {
    this.intervals.splice(index, 1);
  }

  public async openTimePicker(index: number, type: 'from' | 'to') {
    const modal = await this._modalCtrl.create({
      component: TimePickerModalComponent,
      componentProps: { value: this.intervals[index][type] },
      breakpoints: [0, 0.40, 0.60],
      initialBreakpoint: 0.40,
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm' && data) {
      this.intervals[index][type] = data.time;
    }
  }

  public sendForm() {

  }

  private buildConsultationForm(): void {
    this.typeAppointmentsForm = this._formBuilder.group({
      appointmentType: ['', Validators.required]
    });
  }

  private buildDaysOfServiceForm(): void {
    this.daysOfServiceForm = this._formBuilder.group({
      applyTo: ['', Validators.required],
      daysOfService: new FormControl(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']),
    });
  }

  private getAppointmentTypes() {
    this._appointmentTypesService.getAppointmentTypes("2808").subscribe({
      next: (response) => {
        this._appointmentTypes = response;
        this.consultationTypeConfig.optionsList = mapObjectToSelectOptions(response);
        this.loading = false; 
      },
      error: (error) => {
        console.error(error);
      }
    });
  }

}
