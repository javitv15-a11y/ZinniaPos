import {ChangeDetectorRef, Component, OnInit, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {IonicModule, NavController } from '@ionic/angular';
import {BusinessAccountInfoComponent} from "./components/business-account-info/business-account-info.component";
import {BusinessTypeComponent} from "./components/business-type/business-type.component";
import {UserAccountInfoComponent} from "./components/user-account-info/user-account-info.component";
import { StepperComponent } from 'src/app/shared/components/stepper/stepper.component';
import { StepData } from 'src/app/core/consts/types/steps.type';
import { Router } from '@angular/router';
import { LoadingService } from 'src/app/core/services/utils/loading.service';
import { AuthService } from 'src/app/core/services/bussiness/auth.service';
import { LocalStorageService } from 'src/app/core/services/utils/storage/local-storage.service';
import { StorageKeys } from 'src/app/core/consts/enums/storage-keys.enum';
import { AlertService } from 'src/app/core/services/utils/alert.service';

@Component({
    selector: 'app-register',
    templateUrl: './register.component.html',
    styleUrls: ['./register.component.scss'],
    standalone: true,
    imports: [
        CommonModule,
        IonicModule,
        BusinessAccountInfoComponent,
        BusinessTypeComponent,
        UserAccountInfoComponent,
        StepperComponent,
    ]
})
export class RegisterComponent implements OnInit {

    @ViewChild(BusinessTypeComponent) businessTypeComponent!: BusinessTypeComponent;
    @ViewChild(BusinessAccountInfoComponent) businessAccountInfoComponent!: BusinessAccountInfoComponent;
    @ViewChild(UserAccountInfoComponent) userAccountInfoComponent!: UserAccountInfoComponent;

    public totalSteps: number = 3;
    public currentStep: number = 1;
    public isCurrentFormValid = false;
    public registeredData!: StepData[];

    constructor(
        private _router: Router,
        private _cdr: ChangeDetectorRef,
        private navCtrl: NavController,
        private authService: AuthService,
        private _alertService: AlertService,
        private _loadingService: LoadingService,
        private _localStorageService: LocalStorageService
    ) { }

    ngOnInit() { }
    
    public prevStep() {
        this.navCtrl.back();
    }

    public nextStep() {
        switch (this.currentStep) {
            case 1:
                this.businessTypeComponent.emitData();
                break;
            case 2:
                this.businessAccountInfoComponent.emitData();
                break;
            case 3:
                this.userAccountInfoComponent.emitData();;
                break;
            default:
                throw new Error(`Paso no definido: currentStep`);
        }
    }

    public handleValidityChange(isValid: boolean): void {
        this.isCurrentFormValid = isValid;
        this._cdr.detectChanges();
    }

    public async handleStepData(data: StepData) {
        await this.saveForm(data);
        this.currentStep === this.totalSteps ? this.verifyEmail() :  this.currentStep += 1;
    }

    private goToAccountActivation(id: string, email: string, password: string) {
        this._router.navigate(['/validate-code'], {
            state: { id, email, password }
        });
    }

    private async saveForm(stepData: StepData) {
        const registeredData: StepData[] = await this._localStorageService.getItem(StorageKeys.REGISTRATION_FORM) || [];
        const stepIndex = registeredData.findIndex(entry => entry.step === this.currentStep);

        if (stepIndex !== -1) {
            registeredData[stepIndex] = stepData;
        } else {
            registeredData.push(stepData);
        }   

        this._localStorageService.create(StorageKeys.REGISTRATION_FORM, registeredData);
    }

    private async verifyEmail() {
        await this._loadingService.showLoading("Verificando...");
        this.registeredData = await this._localStorageService.getItem(StorageKeys.REGISTRATION_FORM);
        const { email } = this.registeredData[2].data;

        this.authService.verifyEmail(email).subscribe({
            next: async (response) => {
                await this._loadingService.hideLoading();
                if(response.length) {
                    if(response[0].estado === "0") {
                        this.showCodeResendAlert();
                    }
                }else {
                    this.registerUserInfo();
                }
            },
            error: async(error) => {
                await this._loadingService.hideLoading();
                console.error(error);
            }
        });
    }

    private async showCodeResendAlert() {
        const { id, email, password } = this.registeredData[2].data;
        await this._alertService.presentConfirm(
            '¿Reenviar codigo de verificacion?',
            'Este correo ya se encuentra registrado, confirma si deseas recibir un nuevo codigo de verificacion.',
            () => this.goToAccountActivation(id, email, password),
            () => console.log('Cancelar')
        );
    }
 
    private async registerUserInfo() {
        await this._loadingService.showLoading("Registrando datos...");
        const payload = { fullname: "Antonio", email: "antony@gmail.com" };
        this.authService.registerUser(payload).subscribe({
            next: async(response) => {
                if(response) {
                    await this._loadingService.hideLoading();
                    const { id, email, password } = this.registeredData[2].data;
                    this.goToAccountActivation(id, email, password);
                }
            },
            error: async (error) => {
                await this._loadingService.hideLoading();
                console.error(error);
            }
        });
    }

}