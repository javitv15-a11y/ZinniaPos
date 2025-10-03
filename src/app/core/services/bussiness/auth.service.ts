import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, of, throwError } from "rxjs";
import { delay } from "rxjs/operators";
import { environment } from "src/environments/environment";

import { ILoginRequest, ILoginResponse } from "../../interfaces/bussiness/login.interface";
import { IUser } from "../../interfaces/bussiness/user.interface";
import { IEmailVerifyResponse } from "../../interfaces/bussiness/verify.interface";
import { IRegisterRequest } from "../../interfaces/bussiness/register.interface";

@Injectable({ providedIn: "root" })
export class AuthService {
  // Mock local (ajusta/borra cuando conectes API real)
  private registeredUsers: IUser[] = [
    {
      id: "1",
      idunico: "2222",
      onesignal: "",
      fullname: "Jorge Luis Mendez",
      email: "jorge.mendezj@example.com",
      activacion: "1101",
      estado: "1",
      mostrar: "",
      token: "b368126gw",
      password: "Z1nnia*2024",
    },
    {
      id: "2",
      idunico: "33202",
      onesignal: "12345678",
      fullname: "Maria Alejandra Mendez",
      email: "maralmeji2@example.com",
      activacion: "2202",
      estado: "1",
      mostrar: "",
      token: "H233847U",
      password: "MiClaveFuerte#9",
    },
  ];

  constructor(private http: HttpClient) {}

  /**
   * Mock de login:
   * - Busca usuario por email (se espera email sanitizado en el componente).
   * - Valida password y devuelve ILoginResponse (array con 1 usuario).
   * - En error, devuelve shape similar a backend real (status + error.code).
   */
  public login(payload: ILoginRequest): Observable<ILoginResponse> {
    const userFound = this.registeredUsers.find(u => u.email === payload.email);

    if (!userFound) {
      return throwError(() => ({
        status: 404,
        error: { code: "USER_NOT_FOUND", message: "Usuario no encontrado" },
      }));
    }

    const ok = (userFound as any).password === payload.password;
    if (!ok) {
      return throwError(() => ({
        status: 401,
        error: { code: "INVALID_PASSWORD", message: "Credenciales inválidas" },
      }));
    }

    // Mantén un pequeño delay para simular API; ajusta o quita si quieres.
    return of([userFound] as ILoginResponse).pipe(delay(300));
  }

  /**
   * Registro: recibe un payload simple (no IUser completo),
   * construye internamente el IUser y lo retorna.
   */
  public registerUser(newUser: IRegisterRequest): Observable<IUser> {
    const user: IUser = {
      id: this.genId(),
      idunico: this.genUniqueId(),
      onesignal: "",
      fullname: (newUser.fullname ?? "").trim(),
      email: (newUser.email ?? "").toLowerCase().trim(),
      activacion: this.genActivationCode(),
      estado: "1",
      mostrar: "",
      token: this.genToken(),
      password: newUser.password ?? "", // ⚠️ sólo mock
    };

    this.registeredUsers.push(user);
    return of(user).pipe(delay(300));
  }

  /**
   * Mock de verificación de email
   */
  public verifyEmail(email: string): Observable<IEmailVerifyResponse[]> {
    const mock: IEmailVerifyResponse[] = [
      {
        id: "1",
        idunico: "28778327",
        onesignal: "",
        fullname: "Jorge Luis Mendez",
        email: "jorge.mendezj@cecar.edu.co",
        activacion: "1101",
        estado: "0",
        mostrar: "1",
      },
    ];
    return of(mock).pipe(delay(200));
  }

  /**
   * Mocks auxiliares (ajústalos según tu backend real)
   */
  public sendActivationCode(userId: string): Observable<boolean> {
    return of(true).pipe(delay(300));
  }

  public updateUserWithoutToken(data: Partial<IUser>): Observable<boolean> {
    return of(true).pipe(delay(300));
  }

  // ===== helpers mock =====
  private genId(): string {
    return (this.registeredUsers.length + 1).toString();
  }
  private genUniqueId(): string {
    return Math.floor(10000 + Math.random() * 90000).toString();
  }
  private genActivationCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }
  private genToken(): string {
    return Math.random().toString(36).slice(2, 10).toUpperCase();
  }
}
