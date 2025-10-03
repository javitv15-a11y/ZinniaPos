// src/app/core/services/bussiness/clientes.service.ts
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { ApiService } from "../../../data/api.service";

const DEBUG = false; // cambia a true para ver logs en consola

export interface ClienteApi {
  id: string;
  nombre: string;
  correo: string;
  telefono: string;
  direccion: string;
  fecha_registro: string;
}

export interface CreateClienteDto {
  nombre: string;
  correo: string;
  telefono: string;
  direccion: string;
  fecha_registro?: string;
}
export interface CreateClienteResult {
  ok: boolean;
  id?: string;
  raw?: any;
}

export interface UpdateClienteDto {
  id: string;
  nombre?: string;
  correo?: string;
  telefono?: string;
  direccion?: string;
  fecha_registro?: string;
}
export interface UpdateClienteResult {
  ok: boolean;
  raw?: any;
  changed?: boolean; // 👈 agregado
  after?: ClienteApi | null; // 👈 agregado
}

export interface DeleteClienteResult {
  ok: boolean;
  raw?: any;
}

// Helpers de tipos
type BackendErrors = Record<string, string | string[]>;

@Injectable({ providedIn: "root" })
export class ClientesService {
  /** Ajusta con o sin slash según tu backend. Prueba '/clientes' vs '/clientes/' si no responde. */
  private static readonly PATH = "/clientes";

  constructor(private api: ApiService) {}

  /** Normaliza posibles variantes del backend a nuestra interfaz */
  private normalize = (raw: any): ClienteApi => ({
    id: String(raw?.id ?? raw?._id ?? raw?.cliente_id ?? ""),
    nombre: String(raw?.nombre ?? raw?.name ?? "").trim(),
    correo: String(raw?.correo ?? raw?.email ?? "").trim(), // email→correo
    telefono: String(raw?.telefono ?? raw?.celular ?? raw?.phone ?? ""),
    direccion: String(raw?.direccion ?? raw?.address ?? ""),
    fecha_registro: String(
      raw?.fecha_registro ??
        raw?.fechaRegistro ??
        raw?.fecha ??
        raw?.created_at ??
        ""
    ),
  });

  // ---------- Extractores robustos ----------
  /** Intenta extraer un array de múltiples shapes comunes */
  private extractArray(resp: any): any[] {
    if (DEBUG) console.debug("[ClientesService] RAW list resp:", resp);
    if (Array.isArray(resp)) return resp;

    // Nivel 1 directo
    if (Array.isArray(resp?.data)) return resp.data;
    if (Array.isArray(resp?.clientes)) return resp.clientes;
    if (Array.isArray(resp?.items)) return resp.items;
    if (Array.isArray(resp?.rows)) return resp.rows;
    if (Array.isArray(resp?.result)) return resp.result;
    if (Array.isArray(resp?.results)) return resp.results;

    // Nivel 2 {data:{items:[...]}} u otros
    const d = resp?.data;
    if (d) {
      if (Array.isArray(d?.items)) return d.items;
      if (Array.isArray(d?.rows)) return d.rows;
      if (Array.isArray(d?.result)) return d.result;
      if (Array.isArray(d?.results)) return d.results;
      if (Array.isArray(d?.clientes)) return d.clientes;
    }

    // Como último recurso, si parece objeto con claves numéricas
    const maybeArray =
      resp && typeof resp === "object" ? Object.values(resp) : [];
    if (maybeArray.every((v) => typeof v === "object"))
      return maybeArray as any[];

    return [];
  }

  /** Intenta extraer un objeto (GET by id) desde varias formas comunes */
  private extractObject(resp: any): any | null {
    if (DEBUG) console.debug("[ClientesService] RAW byId resp:", resp);
    if (!resp) return null;

    // Si viene directo
    if (
      !Array.isArray(resp) &&
      typeof resp === "object" &&
      !("length" in resp)
    ) {
      // Si es {data:{...}} o {data:[...]}
      if (resp.data) {
        if (Array.isArray(resp.data)) return resp.data[0] ?? null;
        if (typeof resp.data === "object") return resp.data;
      }
      // Si es {cliente:{...}}
      if (resp.cliente && typeof resp.cliente === "object") return resp.cliente;

      return resp; // objeto directo
    }

    // Si vino como array, tomar primer elemento
    if (Array.isArray(resp)) return resp[0] ?? null;

    return null;
  }

  /** Extrae el primer mensaje legible de validaciones/errores del backend */
  private extractFirstErrorMessage(err: any): string | undefined {
    if (typeof err?.error?.message === "string" && err.error.message.trim()) {
      return err.error.message.trim();
    }
    const errors = (err?.error?.errors ?? err?.errors) as
      | BackendErrors
      | undefined;
    if (errors && typeof errors === "object") {
      const v = Object.values(errors)[0];
      if (Array.isArray(v)) return String(v[0] ?? "").trim() || undefined;
      if (typeof v === "string") return v.trim() || undefined;
    }
    if (typeof err?.message === "string" && err.message.trim()) {
      return err.message.trim();
    }
    return undefined;
  }

  // ---------- GET /clientes (lista) ----------
  async getClientes(): Promise<ClienteApi[]> {
    const resp: any = await firstValueFrom(
      this.api.get<any>(ClientesService.PATH)
    );
    const arr = this.extractArray(resp);
    if (DEBUG)
      console.debug("[ClientesService] parsed list length:", arr.length);
    return arr.map(this.normalize);
  }

  // ---------- GET /clientes/:id (con varios fallbacks) ----------
  async getClienteById(id: string): Promise<ClienteApi | null> {
    const safeId = String(id || "").trim();
    if (!safeId) return null;

    // 1) REST estándar: /clientes/:id
    try {
      const resp: any = await firstValueFrom(
        this.api.get<any>(
          `${ClientesService.PATH}/${encodeURIComponent(safeId)}`
        )
      );
      const obj = this.extractObject(resp);
      if (obj) return this.normalize(obj);
    } catch (e) {
      if (DEBUG) console.debug("[ClientesService] byId primary failed:", e);
    }

    // 2) Fallback: /clientes?id=...
    try {
      const resp: any = await firstValueFrom(
        this.api.get<any>(
          `${ClientesService.PATH}?id=${encodeURIComponent(safeId)}`
        )
      );
      const obj = this.extractObject(resp) ?? this.extractArray(resp)[0];
      if (obj) return this.normalize(obj);
    } catch (e) {
      if (DEBUG) console.debug("[ClientesService] byId query param failed:", e);
    }

    // 3) Fallback: /clientes/show?id=...
    try {
      const resp: any = await firstValueFrom(
        this.api.get<any>(
          `${ClientesService.PATH}/show?id=${encodeURIComponent(safeId)}`
        )
      );
      const obj = this.extractObject(resp) ?? this.extractArray(resp)[0];
      if (obj) return this.normalize(obj);
    } catch (e) {
      if (DEBUG) console.debug("[ClientesService] byId show failed:", e);
    }

    // 4) Último recurso: listar y filtrar
    try {
      const all = await this.getClientes();
      return all.find((c) => String(c.id) === safeId) ?? null;
    } catch {
      return null;
    }
  }

  // ---------- POST /clientes (x-www-form-urlencoded) ----------
  async createCliente(input: CreateClienteDto): Promise<CreateClienteResult> {
    const payload: {
      nombre: string;
      email: string;
      telefono: string;
      direccion: string;
      fecha_registro?: string;
    } = {
      nombre: input.nombre,
      email: input.correo,
      telefono: input.telefono,
      direccion: input.direccion,
      ...(input.fecha_registro ? { fecha_registro: input.fecha_registro } : {}),
    };

    try {
      const resp: any = await firstValueFrom(
        this.api.postUrlEncoded<any>(ClientesService.PATH, payload)
      );
      const ok = resp?.success === true || resp?.ok === true || true;
      const rawId = resp?.id ?? resp?.data?.id;
      const id = rawId !== true && rawId != null ? String(rawId) : undefined;
      if (DEBUG) console.debug("[ClientesService] create resp:", resp);
      return { ok, id, raw: resp };
    } catch (e: unknown) {
      const msg =
        this.extractFirstErrorMessage(e) ?? "No se pudo crear el cliente";
      throw new Error(String(msg));
    }
  }

  async updateCliente(input: {
    id: string;
    nombre?: string;
    correo?: string;
    telefono?: string;
    direccion?: string;
    fecha_registro?: string;
  }): Promise<UpdateClienteResult> {
    const id = String(input?.id || "").trim();
    if (!id) throw new Error("Falta el id del cliente");

    // traer el estado actual
    const current = await this.getClienteById(id);
    if (!current) throw new Error("Cliente no encontrado");

    // body con los campos actualizados o actuales
    const body = {
      nombre: input.nombre ?? current.nombre,
      correo: input.correo ?? current.correo, // 👈 correo, no email
      telefono: input.telefono ?? current.telefono,
      direccion: input.direccion ?? current.direccion,
      ...(input.fecha_registro ?? current.fecha_registro
        ? { fecha_registro: input.fecha_registro ?? current.fecha_registro }
        : {}),
    };

    // PUT /clientes/{id}
    const resp: any = await firstValueFrom(
      this.api.put<any>(`/clientes/${encodeURIComponent(id)}`, body)
    );

    // traer de nuevo para comparar
    const after = await this.getClienteById(id);

    const changed =
      !!after &&
      (after.nombre !== current.nombre ||
        after.correo !== current.correo ||
        after.telefono !== current.telefono ||
        after.direccion !== current.direccion ||
        (after.fecha_registro || "") !== (current.fecha_registro || ""));

    const ok =
      resp?.success === true ||
      resp?.ok === true ||
      resp?.status === "ok" ||
      changed;

    return { ok, raw: resp, changed, after };
  }

  // ---------- DELETE /clientes/:id (eliminar) con fallbacks ----------
  async deleteCliente(id: string): Promise<DeleteClienteResult> {
    const safeId = String(id || "").trim();
    if (!safeId) throw new Error("Falta el id del cliente");

    // 1) DELETE /clientes/:id
    try {
      const resp: any = await firstValueFrom(
        this.api.delete<any>(
          `${ClientesService.PATH}/${encodeURIComponent(safeId)}`
        )
      );
      const ok =
        resp?.success === true || resp?.ok === true || resp === true || true;
      if (DEBUG) console.debug("[ClientesService] delete primary resp:", resp);
      return { ok, raw: resp };
    } catch (e) {
      if (DEBUG) console.debug("[ClientesService] delete primary failed:", e);
    }

    // 2) POST /clientes/delete
    try {
      const resp: any = await firstValueFrom(
        this.api.postUrlEncoded<any>(`${ClientesService.PATH}/delete`, {
          id: safeId,
        })
      );
      const ok =
        resp?.success === true || resp?.ok === true || resp === true || true;
      if (DEBUG) console.debug("[ClientesService] delete fallback resp:", resp);
      return { ok, raw: resp };
    } catch (e) {
      if (DEBUG) console.debug("[ClientesService] delete fallback failed:", e);
    }

    // 3) POST /clientes/eliminar
    try {
      const resp: any = await firstValueFrom(
        this.api.postUrlEncoded<any>(`${ClientesService.PATH}/eliminar`, {
          id: safeId,
        })
      );
      const ok =
        resp?.success === true || resp?.ok === true || resp === true || true;
      if (DEBUG) console.debug("[ClientesService] delete final resp:", resp);
      return { ok, raw: resp };
    } catch (e: unknown) {
      const msg =
        this.extractFirstErrorMessage(e) ?? "No se pudo eliminar el cliente";
      throw new Error(String(msg));
    }
  }
}
