import { Routes } from "@angular/router";
import { MovementsManagementComponent } from "./components/movements-management/movements-management.component";

export const movementsRoutes: Routes = [
  {
    path: "",
    pathMatch: "full",
    component: MovementsManagementComponent,
    data: { showTab: true, title: "Movimientos" },
  },


  {
    path: "purchase-supplier",
    loadComponent: () =>
      import("./components/movements-purchase-supplier/movements-purchase-supplier.component")
        .then(m => m.MovementsPurchaseSupplierComponent),
    data: { title: "Compra a proveedor" },
  },

  {
    path: ":id",
    loadComponent: () =>
      import("./components/movements-detail/movements-detail.component")
        .then(m => m.MovementsDetailComponent),
  },

  { path: "**", redirectTo: "" },
];
