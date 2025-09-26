// src/app/data/api.service.ts
import { Injectable } from "@angular/core";
import { HttpClient, HttpParams, HttpHeaders, HttpErrorResponse } from "@angular/common/http";
import { environment } from "../../environments/environment";

type Opts = { skipAuth?: boolean };

@Injectable({ providedIn: "root" })
export class ApiService {
  // Normalizamos base para quitar barras finales; si no hay base, queda ""
  private readonly base =
    String(((environment as any).apiBase ?? (environment as any).API) ?? "")
      .replace(/\/+$/, "");

  constructor(private http: HttpClient) {}

  /** Si la URL es absoluta (http/https), NO concatenar base. Si es relativa, unir con una sola barra. */
  private resolveUrl(path: string): string {
    if (!path) return this.base || "";
    if (/^https?:\/\//i.test(path)) return path; // absoluta → usar tal cual
    if (!this.base) {
      // sin base configurada: devolver path tal cual (relativa)
      return path.startsWith("/") ? path : `/${path}`;
    }
    const p = path.startsWith("/") ? path : `/${path}`;
    return `${this.base}${p}`;
  }

  get<T>(path: string, params?: Record<string, any>, opts?: Opts) {
    let hp = new HttpParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v == null) continue;
        if (Array.isArray(v)) v.forEach(val => (hp = hp.append(k, String(val))));
        else hp = hp.set(k, String(v));
      }
    }
    let headers = new HttpHeaders();
    if (opts?.skipAuth) headers = headers.set("X-Skip-Auth", "1");
    return this.http.get<T>(this.resolveUrl(path), { params: hp, headers });
  }

  post<T>(path: string, body: any, opts?: Opts) {
    let headers = new HttpHeaders();
    if (opts?.skipAuth) headers = headers.set("X-Skip-Auth", "1");
    return this.http.post<T>(this.resolveUrl(path), body, { headers });
  }

  put<T>(path: string, body: any, opts?: Opts) {
    let headers = new HttpHeaders();
    if (opts?.skipAuth) headers = headers.set("X-Skip-Auth", "1");
    // console.log("[ApiService.put] =>", this.resolveUrl(path), body);
    return this.http.put<T>(this.resolveUrl(path), body, { headers });
  }

  delete<T>(path: string, opts?: Opts) {
    let headers = new HttpHeaders();
    if (opts?.skipAuth) headers = headers.set("X-Skip-Auth", "1");
    return this.http.delete<T>(this.resolveUrl(path), { headers });
  }

  upload<T>(path: string, fd: FormData, opts?: Opts) {
    let headers = new HttpHeaders();
    if (opts?.skipAuth) headers = headers.set("X-Skip-Auth", "1");
    return this.http.post<T>(this.resolveUrl(path), fd, { headers });
  }

  /** POST x-www-form-urlencoded (simple request ⇒ sin preflight si no hay headers custom) */
  postUrlEncoded<T>(path: string, payload: Record<string, any>, opts?: Opts) {
    const fromObject: Record<string, string> = {};
    for (const [k, v] of Object.entries(payload)) fromObject[k] = v == null ? "" : String(v);
    const body = new HttpParams({ fromObject }).toString();
    let headers = new HttpHeaders({
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      Accept: "application/json",
    });
    if (opts?.skipAuth) headers = headers.set("X-Skip-Auth", "1");
    return this.http.post<T>(this.resolveUrl(path), body, { headers });
  }
}
