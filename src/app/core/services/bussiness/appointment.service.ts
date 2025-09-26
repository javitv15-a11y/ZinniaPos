// src/app/core/services/bussiness/appointment.service.ts
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { ApiService } from "src/app/data/api.service";

export type CitaEstado = "Agendada" | "Completada" | "Cancelada" | string;

export interface AppointmentApi {
  id: string;
  cliente_id: string;
  servicio_id: string;
  fecha: string; // 'YYYY-MM-DD'
  hora_inicio: string; // 'HH:mm:ss' | 'HH:mm'
  hora_fin: string; // 'HH:mm:ss' | 'HH:mm'
  estado: CitaEstado;
  origen?: string;
  telefono?: string;
  updated_at?: string;
  cliente_nombre?: string;
  servicio_nombre?: string;

  // Campos adicionales del backend (opcionales en el API normalizado)
  sede_id?: string | null;
  profesional_id?: string | null;
  servicio_principal_id?: string;
  duracion_total_min?: string; // llega como string en el ejemplo
  tipo_consulta?: string;
  canal?: string;
  observaciones?: string;
  created_at?: string;
}

export interface CreateAppointmentDto {
  clienteId: string;
  servicio_id?: string; // opcional si usas servicio_principal_id
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado?: CitaEstado;

  // Campos opcionales para mapear al backend
  servicio_principal_id?: string;
  duracion_total_min?: string | number;
  tipoConsulta?: string;
  canal?: string;
  observaciones?: string;
  sede_id?: string | number | null;
  profesional_id?: string | number | null;
}

export type UpdateAppointmentDto = Partial<
  Pick<
    CreateAppointmentDto,
    | "servicio_id"
    | "servicio_principal_id"
    | "fecha"
    | "hora_inicio"
    | "hora_fin"
    | "estado"
    | "duracion_total_min"
    | "tipoConsulta"
    | "canal"
    | "observaciones"
    | "sede_id"
    | "profesional_id"
  >
>;

export interface CreateAppointmentResult {
  ok: boolean;
  id?: string;
  raw?: any;
}

type BackendErrors = Record<string, string | string[]>;

function unwrapArray(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && Array.isArray(raw.data)) return raw.data;
  return [];
}

@Injectable({ providedIn: "root" })
export class AppointmentsService {
  private static readonly BASES = [
    "https://codigofuentecorp.eastus.cloudapp.azure.com/zinnia-apis-php/public/list/citas/",
  ];

  private static readonly BY_CLIENTE_PATHS = ["cliente", "by-cliente", "client"];

  constructor(private api: ApiService) {}

  /* ===== Normalización / errores ===== */
  private normalize = (raw: any): AppointmentApi => ({
    // IDs y relaciones
    id: String(raw?.id ?? raw?.Id ?? ""),
    cliente_id: String(raw?.cliente_id ?? raw?.ClienteId ?? raw?.clienteId ?? ""),
    servicio_id: String(
      raw?.servicio_id ??
        raw?.servicioId ??
        raw?.servicio_principal_id ?? // usar servicio_principal_id como fallback de servicio_id
        ""
    ),

    // Fechas y horas
    fecha: String(raw?.fecha ?? raw?.FechaCita ?? ""),
    hora_inicio: String(raw?.hora_inicio ?? raw?.horaInicio ?? raw?.HoraInicio ?? ""),
    hora_fin: String(raw?.hora_fin ?? raw?.horaFin ?? raw?.HoraFin ?? ""),

    // Estado
    estado: String(raw?.estado ?? raw?.Estado ?? "Agendada"),

    // Metadatos / opcionales
    origen: raw?.origen ?? raw?.source ?? raw?.canal ?? undefined,
    telefono: raw?.telefono ?? raw?.numero_celular ?? undefined,
    updated_at: raw?.updated_at ?? raw?.updatedAt ?? raw?.fecha_actualizacion ?? undefined,
    cliente_nombre: raw?.cliente_nombre ?? raw?.clienteNombre ?? undefined,
    servicio_nombre: raw?.servicio_nombre ?? raw?.servicioNombre ?? undefined,

    // Campos adicionales (se conservan en la salida normalizada)
    sede_id: raw?.sede_id ?? null,
    profesional_id: raw?.profesional_id ?? null,
    servicio_principal_id: raw?.servicio_principal_id ? String(raw.servicio_principal_id) : undefined,
    duracion_total_min: raw?.duracion_total_min != null ? String(raw.duracion_total_min) : undefined,
    tipo_consulta: raw?.tipo_consulta ?? raw?.TipoConsulta ?? undefined,
    canal: raw?.canal ?? undefined,
    observaciones: raw?.observaciones ?? raw?.Observaciones ?? undefined,
    created_at: raw?.fecha_creacion ?? undefined,
  });

  private errMsg(err: any): string | undefined {
    if (typeof err?.error?.message === "string" && err.error.message.trim())
      return err.error.message.trim();
    const errors = (err?.error?.errors ?? err?.errors) as BackendErrors | undefined;
    if (errors && typeof errors === "object") {
      const v = Object.values(errors)[0];
      if (Array.isArray(v)) return String(v[0] ?? "").trim() || undefined;
      if (typeof v === "string") return v.trim() || undefined;
    }
    if (typeof err?.message === "string" && err.message.trim()) return err.message.trim();
    return undefined;
  }

  /* ===== Helpers HTTP con fallback de rutas ===== */
  private async tryGetMany(paths: string[]): Promise<any[]> {
    let lastErr: any;
    for (const p of paths) {
      try {
        const raw = await firstValueFrom(this.api.get<any>(p));
        return unwrapArray(raw);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  }

  private async tryGetOne(paths: string[]): Promise<any> {
    let lastErr: any;
    for (const p of paths) {
      try {
        return await firstValueFrom(this.api.get<any>(p));
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  }

  /* =======================
   *         GET
   * ======================= */

  async getAll(): Promise<AppointmentApi[]> {
    try {
      const arr = await this.tryGetMany(AppointmentsService.BASES);
      return arr.map(this.normalize);
    } catch (e: any) {
      throw new Error(this.errMsg(e) ?? "No se pudieron obtener las citas");
    }
  }

  /** ✅ Helper silencioso: nunca lanza error */
  async getAllSafe(): Promise<AppointmentApi[]> {
    try {
      return await this.getAll();
    } catch {
      return [];
    }
  }

  /** GET /{base}/{id} */
  async getById(id: string): Promise<AppointmentApi> {
    const paths = AppointmentsService.BASES.map(
      (b) => `${b}${b.endsWith("/") ? "" : "/"}${encodeURIComponent(id)}`
    );
    try {
      const data = await this.tryGetOne(paths);
      return this.normalize(data?.data ?? data);
    } catch (e: any) {
      throw new Error(this.errMsg(e) ?? "No se pudo obtener la cita");
    }
  }

  /** GET /{base}/(cliente|by-cliente|client)/:id */
  async getByCliente(clienteId: string): Promise<AppointmentApi[]> {
    const paths: string[] = [];
    for (const b of AppointmentsService.BASES) {
      const base = b.endsWith("/") ? b.slice(0, -1) : b;
      for (const seg of AppointmentsService.BY_CLIENTE_PATHS) {
        paths.push(`${base}/${seg}/${encodeURIComponent(clienteId)}`);
      }
    }
    try {
      const arr = await this.tryGetMany(paths);
      return arr.map(this.normalize);
    } catch (e: any) {
      throw new Error(this.errMsg(e) ?? "No se pudieron obtener las citas del cliente");
    }
  }

  /** ✅ Helper silencioso para pantallas que no quieren romperse */
  async getByClienteSilent(clienteId: string): Promise<AppointmentApi[]> {
    try {
      return await this.getByCliente(clienteId);
    } catch {
      return [];
    }
  }

  /** (opcional) mismo que getByCliente, solo alias para conveniencia */
  async getByClienteFlat(clienteId: string): Promise<AppointmentApi[]> {
    return this.getByCliente(clienteId);
  }

  /* =======================
   *       CREATE/UPDATE
   * ======================= */

  /** POST create con DTO (forma genérica, mapea a campos del backend) */
  async create(input: CreateAppointmentDto): Promise<CreateAppointmentResult> {
    const payload: any = {
      // IDs requeridos
      ClienteId: input.clienteId,
      // servicio: usa servicio_principal_id si viene, si no servicio_id
      ...(input.servicio_principal_id
        ? { servicio_principal_id: input.servicio_principal_id }
        : input.servicio_id
        ? { servicio_principal_id: input.servicio_id }
        : {}),
      // fecha y horas
      FechaCita: input.fecha,
      HoraInicio: input.hora_inicio,
      HoraFin: input.hora_fin,
      // estado
      ...(input.estado ? { Estado: input.estado } : {}),
      // extras
      ...(input.duracion_total_min != null
        ? { duracion_total_min: String(input.duracion_total_min) }
        : {}),
      ...(input.tipoConsulta ? { TipoConsulta: input.tipoConsulta } : {}),
      ...(input.canal ? { canal: input.canal } : {}),
      ...(input.observaciones ? { Observaciones: input.observaciones } : {}),
      ...(input.sede_id != null ? { sede_id: input.sede_id } : {}),
      ...(input.profesional_id != null ? { profesional_id: input.profesional_id } : {}),
    };

    let lastErr: any;
    for (const b of AppointmentsService.BASES) {
      try {
        const resp = await firstValueFrom(this.api.post<any>(b, payload));
        const ok = resp?.success === true || resp?.ok === true || true;
        const rawId = resp?.id ?? resp?.Id ?? resp?.data?.id ?? resp?.data?.Id;
        const id = rawId != null && rawId !== true ? String(rawId) : undefined;
        return { ok, id, raw: resp };
      } catch (e) {
        lastErr = e;
      }
    }
    throw new Error(this.errMsg(lastErr) ?? "No se pudo crear la cita");
  }

  /**
   * POST create con payload EXACTO del backend
   */
  async createRaw(body: {
    ClienteId: number | string;
    servicio_principal_id: number | string;
    duracion_total_min?: number | string;
    TipoConsulta?: string | number;
    FechaCita: string;
    HoraInicio: string;
    HoraFin: string;
    Estado?: string;
    canal?: string;
    Observaciones?: string;
    sede_id?: number | string | null;
    profesional_id?: number | string | null;
  }): Promise<CreateAppointmentResult> {
    let lastErr: any;
    for (const b of AppointmentsService.BASES) {
      try {
        const resp = await firstValueFrom(this.api.post<any>(b, body));
        const ok = resp?.success === true || resp?.ok === true || true;
        const rawId = resp?.id ?? resp?.Id ?? resp?.data?.id ?? resp?.data?.Id;
        const id = rawId != null && rawId !== true ? String(rawId) : undefined;
        return { ok, id, raw: resp };
      } catch (e) {
        lastErr = e;
      }
    }
    throw new Error(this.errMsg(lastErr) ?? "No se pudo crear la cita");
  }

  /** PUT update (acepta nombres “frontend”, mapea a backend) */
  async update(id: string, changes: UpdateAppointmentDto): Promise<boolean> {
    const payload: any = {
      // servicio
      ...(changes.servicio_principal_id
        ? { servicio_principal_id: changes.servicio_principal_id }
        : changes.servicio_id
        ? { servicio_principal_id: changes.servicio_id }
        : {}),
      // fecha/horas
      ...(changes.fecha ? { FechaCita: changes.fecha } : {}),
      ...(changes.hora_inicio ? { HoraInicio: changes.hora_inicio } : {}),
      ...(changes.hora_fin ? { HoraFin: changes.hora_fin } : {}),
      // estado
      ...(changes.estado ? { Estado: changes.estado } : {}),
      // extras
      ...(changes.duracion_total_min != null
        ? { duracion_total_min: String(changes.duracion_total_min) }
        : {}),
      ...(changes.tipoConsulta ? { TipoConsulta: changes.tipoConsulta } : {}),
      ...(changes.canal ? { canal: changes.canal } : {}),
      ...(changes.observaciones ? { Observaciones: changes.observaciones } : {}),
      ...(changes.sede_id != null ? { sede_id: changes.sede_id } : {}),
      ...(changes.profesional_id != null ? { profesional_id: changes.profesional_id } : {}),
    };

    let lastErr: any;
    for (const b of AppointmentsService.BASES) {
      const url = `${b}${b.endsWith("/") ? "" : "/"}${encodeURIComponent(id)}`;
      try {
        await firstValueFrom(this.api.put<any>(url, payload));
        return true;
      } catch (e) {
        lastErr = e;
      }
    }
    throw new Error(this.errMsg(lastErr) ?? "No se pudo actualizar la cita");
  }

  /** PUT cancelar */
  async cancel(id: string): Promise<boolean> {
    let lastErr: any;
    for (const b of AppointmentsService.BASES) {
      const base = b.endsWith("/") ? b.slice(0, -1) : b;
      const url = `${base}/${encodeURIComponent(id)}/cancelar`;
      try {
        await firstValueFrom(this.api.put<any>(url, {}));
        return true;
      } catch (e) {
        lastErr = e;
      }
    }
    throw new Error(this.errMsg(lastErr) ?? "No se pudo cancelar la cita");
  }
}
