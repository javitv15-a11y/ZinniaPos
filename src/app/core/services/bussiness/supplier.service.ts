import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, throwError } from 'rxjs';
import { ISupplier, CreateSupplierPayload, UpdateSupplierPayload } from '../../interfaces/bussiness/supplier.interface';

const BASE = 'https://codigofuentecorp.eastus.cloudapp.azure.com/zinnia-apis-php/public';

type SaveSupplierBackendPayload = {
  nombre: string;
  telefono: string;
  correo: string;
  direccion: string;
  fecha_registro?: string;
};

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private readonly listUrl   = `${BASE}/list/proveedores/`;   // GET
  private readonly saveUrl   = `${BASE}/save/proveedores/`;   // POST
  private readonly updateUrl = `${BASE}/update/proveedores/`; // PUT
  private readonly getById   = (id: string) => `${BASE}/getById/proveedores/${encodeURIComponent(id)}`;
  private readonly delUrl    = (id: string) => `${BASE}/delete/proveedores/${encodeURIComponent(id)}`;
  private readonly countUrl  = `${BASE}/count/proveedores/`;

  private readonly formHeaders = new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' });

  constructor(private http: HttpClient) {}

  private normalize = (raw: any): ISupplier => ({
    id: String(raw?.id ?? ''),
    name: String(raw?.nombre ?? ''),
    phone: raw?.telefono != null ? String(raw.telefono) : undefined,
    email: raw?.correo   != null ? String(raw.correo)   : undefined,
    address: raw?.direccion != null ? String(raw.direccion) : undefined,
    fecha_registro: raw?.fecha_registro ? String(raw.fecha_registro) : undefined,
    createdAt: raw?.createdAt ? String(raw.createdAt) : undefined,
  });

  // ---------- LIST ----------
  getAllSuppliers(): Observable<ISupplier[]> {
    return this.http.get<any[]>(this.listUrl).pipe(
      map(arr => (Array.isArray(arr) ? arr : []).map(this.normalize)),
      catchError(err => throwError(() => new Error(err?.error?.message || 'No se pudo obtener proveedores')))
    );
  }

  // ---------- CREATE (front → backend mapping) ----------
  saveSupplier(payload: CreateSupplierPayload): Observable<boolean> {
    const backend: SaveSupplierBackendPayload = {
      nombre: payload.name,
      telefono: payload.phone,
      correo: payload.email,
      direccion: payload.address,
      ...(payload.fecha_registro ? { fecha_registro: payload.fecha_registro } : {}),
    };

    // form-urlencoded (tu backend lo acepta perfecto)
    let body = new HttpParams()
      .set('nombre', backend.nombre)
      .set('telefono', backend.telefono)
      .set('correo', backend.correo)
      .set('direccion', backend.direccion);

    if (backend.fecha_registro) {
      body = body.set('fecha_registro', backend.fecha_registro);
    }

    return this.http.post<any>(this.saveUrl, body.toString(), { headers: this.formHeaders }).pipe(
      map(() => true), // 200 = ok
      catchError(err => throwError(() => new Error(err?.error?.message || 'No se pudo guardar el proveedor')))
    );
  }

  // ---------- UPDATE ----------
  updateSupplier(payload: UpdateSupplierPayload): Observable<boolean> {
    let body = new HttpParams()
      .set('id', payload.id)
      .set('nombre', payload.name ?? '')
      .set('telefono', payload.phone ?? '')
      .set('correo', payload.email ?? '')
      .set('direccion', payload.address ?? '');

    if (payload.fecha_registro) {
      body = body.set('fecha_registro', payload.fecha_registro);
    }

    return this.http.put<any>(this.updateUrl, body.toString(), { headers: this.formHeaders }).pipe(
      map(() => true),
      catchError(err => throwError(() => new Error(err?.error?.message || 'No se pudo actualizar el proveedor')))
    );
  }

  // ---------- BY ID / DELETE / COUNT ----------
  getSupplierById(id: string): Observable<ISupplier | null> {
    return this.http.get<any[]>(this.getById(id)).pipe(
      map(r => Array.isArray(r) && r.length ? this.normalize(r[0]) : null),
      catchError(err => throwError(() => new Error(err?.error?.message || 'No se pudo obtener el proveedor')))
    );
  }

  deleteSupplier(id: string): Observable<boolean> {
    return this.http.delete<any>(this.delUrl(id)).pipe(
      map(() => true),
      catchError(err => throwError(() => new Error(err?.error?.message || 'No se pudo eliminar el proveedor')))
    );
  }

  getSuppliersCount(): Observable<number> {
    return this.http.get<Array<{ num: number }>>(this.countUrl).pipe(
      map(r => (Array.isArray(r) && r[0] && typeof r[0].num === 'number') ? r[0].num : 0),
      catchError(err => throwError(() => new Error(err?.error?.message || 'No se pudo obtener el conteo')))
    );
  }
}
