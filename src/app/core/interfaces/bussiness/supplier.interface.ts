export interface ISupplier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  fecha_registro?: string;
  createdAt?: string;
}

// Payload para CREAR (front → service)
export type CreateSupplierPayload = {
  name: string;
  phone: string;
  email: string;
  address: string;
  // opcional si quieres también enviarlo
  fecha_registro?: string;
};

// Payload para ACTUALIZAR
export type UpdateSupplierPayload = {
  id: string;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  fecha_registro?: string;
};
