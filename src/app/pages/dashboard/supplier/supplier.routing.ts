// src/app/pages/dashboard/suppliers/suppliers.routes.ts
import { Routes } from "@angular/router";
import { SupplierManagementComponent } from "./components/supplier-management/supplier-management.component";

export const suppliersRoutes: Routes = [
  {
    path: "",
    pathMatch: "full",
    component: SupplierManagementComponent,
    data: { showTab: true, title: "Proveedores" },
  },
  {
    path: ":id",
    loadComponent: () =>
      import("./components/supplier-detail/supplier-detail.component")
        .then((m) => m.SupplierDetailComponent),
    data: { showTab: false, title: "Detalle Proveedor" },
  },
  { path: "**", redirectTo: "" },
];
