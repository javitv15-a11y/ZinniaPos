// src/app/core/consts/values/quick-access.consts.ts
import { BusinessCategoryId } from "src/app/core/consts/enums/business/business-category.enum";
import { QuickAccessItem } from "src/app/core/interfaces/quick-access-list.interface";
import { IToastOptions } from "../../interfaces/toast.interface";

export const quickAccessForServices: QuickAccessItem[] = [
  {
    id: "citas",
    icon: "calendar-outline",
    label: "Citas",
    route: "/dashboard/appointments/appointment-management",
  },
  {
    id: "pacientes",
    label: "Pacientes",
    icon: "person-outline",
    route: "/dashboard/patients",
  },
  {
    id: "agenda",
    label: "Agenda",
    icon: "calendar-number-outline",
    route: "/agenda",
  },
];

export const quickAccessForRetail: QuickAccessItem[] = [
  {
    id: "pedidos",
    label: "Pedidos",
    icon: "cart-outline",
    route: "/dashboard/orders/order-management",
  },
  {
    id: "clientes",
    label: "Clientes",
    icon: "person-outline",
    route: "/dashboard/customers",
  },
  {
    id: "productos",
    label: "Productos",
    icon: "cube-outline",
    route: "/dashboard/products",
  },
  {
    id: "movimientos",
    label: "Movimientos",
    icon: "swap-horizontal-outline",
    route: "/dashboard/movements",
  },
  {
    id: "inventario",
    label: "Inventario",
    icon: "albums-outline",
    route: "/dashboard/inventory",
  },
  {
    id: "proveedores",
    label: "Proveedores",
    icon: "people-outline",
    route: "/dashboard/supplier",
  },
];


export const availableQuickAccess: QuickAccessItem[] = [
  {
    id: "citas",
    icon: "calendar-outline",
    label: "Citas",
    route: "/dashboard/appointments/appointment-management",
  },
  {
    id: "pacientes",
    label: "Pacientes",
    icon: "person-outline",
    route: "/dashboard/patients",
  },
  {
    id: "agenda",
    label: "Agenda",
    icon: "calendar-number-outline",
    route: "/agenda",
  },
  {
    id: "pedidos",
    label: "Pedidos",
    icon: "cart-outline",
    route: "/dashboard/orders/order-management",
  },
  {
    id: "clientes",
    label: "Clientes",
    icon: "person-outline",
    route: "/dashboard/customers",
  },
  {
    id: "productos",
    label: "Productos",
    icon: "cube-outline",
    route: "/dashboard/products",
  },
  {
    id: "movimientos",
    label: "Movimientos",
    icon: "swap-horizontal-outline",
    route: "/dashboard/movements",
  },
  {
    id: "inventario",
    label: "Inventario",
    icon: "albums-outline",
    route: "/dashboard/inventory",
  },
  {
    id: "proveedores",
    label: "Proveedores",
    icon: "people-outline",
    route: "/dashboard/supplier",
  },
];

export const quickAccessMap: Record<BusinessCategoryId, QuickAccessItem[]> = {
  [BusinessCategoryId.HEALTH]: quickAccessForServices,
  [BusinessCategoryId.RETAIL]: quickAccessForRetail,
  [BusinessCategoryId.SERVICES]: quickAccessForServices,
  [BusinessCategoryId.TECHNOLOGY]: [],
  [BusinessCategoryId.OTHER]: [],
};

export const quickAccessEditConfig = {
  title: "Módulos",
  description:
    "Agrega o elimina módulos adicionales a los establecidos por defecto para tu negocio.",
};

export const quickAccessAddMessages: Record<string, IToastOptions> = {
  success: { message: "Módulo agregado correctamente.", color: "success" },
  error: { message: "No se logró agregar el módulo.", color: "danger" },
};

export const quickAccessDeletionMessage: Record<string, IToastOptions> = {
  success: { message: "Módulo removido correctamente.", color: "success" },
  error: { message: "No se logró remover el módulo.", color: "danger" },
};

export const quickAccessEditingActions: Record<
  string,
  Record<string, IToastOptions>
> = {
  save: quickAccessAddMessages,
  delete: quickAccessDeletionMessage,
};
