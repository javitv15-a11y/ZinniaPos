import { addIcons } from "ionicons";
import { LoginImages } from "./login.consts";
import { CommonModule } from "@angular/common";
import { Component, HostListener, OnInit } from "@angular/core";
import { Router, RouterModule, ActivatedRoute } from "@angular/router";
import { environment } from "src/environments/environment";
import {
  eyeOutline,
  eyeOffOutline,
  mailOutline,
  lockClosedOutline,
} from "ionicons/icons";
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { IonicModule } from "@ionic/angular";
import { ModalController } from "@ionic/angular";
import { DirectivesModule } from "src/app/core/directives/directives.module";
import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { AuthSessionService } from "src/app/core/services/utils/auth-session.service";
import { ToastService } from "src/app/core/services/utils/toast.service";
import { LoadingService } from "src/app/core/services/utils/loading.service";

type BackendErrorCode =
  | "USER_NOT_FOUND"
  | "INVALID_PASSWORD"
  | "ACCOUNT_LOCKED"
  | "TOO_MANY_ATTEMPTS"
  | "EMAIL_NOT_VERIFIED"
  | "UNKNOWN";

@Component({
  selector: "app-login",
  templateUrl: "./login.component.html",
  styleUrls: ["./login.component.scss"],
  standalone: true,
  providers: [ModalController],
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    DirectivesModule,
    RouterModule,
    FormsModule,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class LoginComponent implements OnInit {
  public loginImages = LoginImages;
  public loginForm!: FormGroup;

  // Estado UI
  public isSubmitting = false;

  // Errores específicos (backend)
  public serverEmailError: string | null = null;
  public serverPasswordError: string | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private _formBuild: FormBuilder,
    private _toastService: ToastService,
    private _loadingService: LoadingService,
    private _authSessionService: AuthSessionService
  ) {
    addIcons({ mailOutline, lockClosedOutline, eyeOutline, eyeOffOutline });
  }

  ngOnInit(): void {
    this.createForm();
  }

  ionViewWillEnter() {
    if (!this.loginForm) this.createForm();
  }

  get isDevelopment() {
    return !environment.production;
  }

  // Getters para template
  get email() {
    return this.loginForm?.get("email");
  }
  get password() {
    return this.loginForm?.get("password");
  }

  private createForm(): void {
    this.loginForm = this._formBuild.group({
      email: ["", [Validators.required, Validators.email]],
      password: [
        "",
        [
          Validators.required,
          Validators.minLength(8),
          Validators.pattern(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,64}$/
          ),
        ],
      ],
    });

    this.loginForm.valueChanges.subscribe(() => {
      this.serverEmailError = null;
      this.serverPasswordError = null;
    });
  }

  // Enviar con Enter en el form
  @HostListener("document:keyup.enter", ["$event"])
  onEnter(ev: KeyboardEvent) {
    if (!this.loginForm || this.isSubmitting) return;
    const target = ev.target as HTMLElement | null;
    if (target && target.closest("form")) {
      this.login();
    }
  }

  private normalizeBackendError(err: any): BackendErrorCode {
    const status = err?.status;
    const code = err?.error?.code as BackendErrorCode | undefined;
    const message: string = (err?.error?.message || err?.message || "")
      .toString()
      .toLowerCase();

    if (code) return code;

    if (message.includes("usuario no encontrado")) return "USER_NOT_FOUND";
    if (message.includes("credenciales inválidas") || message.includes("credenciales invalidas"))
      return "INVALID_PASSWORD";
    if (message.includes("password") && message.includes("incorrect"))
      return "INVALID_PASSWORD";
    if (message.includes("verify")) return "EMAIL_NOT_VERIFIED";

    switch (status) {
      case 404: return "USER_NOT_FOUND";
      case 401: return "INVALID_PASSWORD";
      case 423: return "ACCOUNT_LOCKED";
      case 429: return "TOO_MANY_ATTEMPTS";
      case 400: return "UNKNOWN";
      default: return "UNKNOWN";
    }
  }

  private showFieldErrors(code: BackendErrorCode) {
    switch (code) {
      case "USER_NOT_FOUND":
        this.serverEmailError = "No encontramos una cuenta con este correo.";
        this.email?.setErrors({ ...(this.email?.errors || {}), server: true });
        break;
      case "INVALID_PASSWORD":
        this.serverPasswordError = "La contraseña es incorrecta.";
        this.password?.setErrors({ ...(this.password?.errors || {}), server: true });
        break;
      case "EMAIL_NOT_VERIFIED":
        this.serverEmailError = "Debes verificar tu correo antes de iniciar sesión.";
        this.email?.setErrors({ ...(this.email?.errors || {}), server: true });
        break;
      case "ACCOUNT_LOCKED":
        this.serverPasswordError =
          "Tu cuenta está bloqueada temporalmente. Inténtalo más tarde o restablece tu contraseña.";
        this.password?.setErrors({ ...(this.password?.errors || {}), server: true });
        break;
      case "TOO_MANY_ATTEMPTS":
        this.serverPasswordError =
          "Demasiados intentos. Espera unos minutos y vuelve a intentar.";
        this.password?.setErrors({ ...(this.password?.errors || {}), server: true });
        break;
      default:
        this._toastService.showToast({
          message: "No pudimos iniciar sesión. Inténtalo otra vez en unos segundos.",
          color: "danger",
        });
    }
  }

  public async login() {
    if (this.isSubmitting) return;
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const raw = this.loginForm.value;
    const payload = {
      email: (raw.email || "").toString().trim().toLowerCase(),
      password: (raw.password || "").toString(),
    };

    this.isSubmitting = true;
    await this._loadingService.showLoading("Iniciando sesión...");

    this._authSessionService.login(payload).subscribe({
      next: async () => {
        await this._loadingService.hideLoading();
        this.isSubmitting = false;

        // Paso 7: prioriza el returnUrl guardado por el interceptor,
        // luego el de query param y si no, cae a /dashboard
        const storedReturn = this._authSessionService.consumeReturnUrl();
        const qpReturn = this.route.snapshot.queryParamMap.get("returnUrl");
        const returnUrl = storedReturn || qpReturn || "/dashboard";

        this.router.navigateByUrl(returnUrl);
      },
      error: async (err) => {
        await this._loadingService.hideLoading();
        this.isSubmitting = false;

        this.serverEmailError = null;
        this.serverPasswordError = null;
        const code = this.normalizeBackendError(err);
        this.showFieldErrors(code);

        if (err?.status === 0) {
          this._toastService.showToast({
            message: "Sin conexión o el servidor no responde. Revisa tu internet y vuelve a intentar.",
            color: "warning",
          });
        }

        console.error(err);
      },
    });
  }
}
