import { Routes } from "@angular/router";
import { InventoryManagementComponent } from "./components/inventory-management/inventory-management.component";

export const inventoryRoutes: Routes = [
  {
    path: "",
    pathMatch: "full",
    component: InventoryManagementComponent,
    data: { showTab: true, title: "Inventario" },
  },
  {
    path: ":id",
    loadComponent: () =>
      import("./components/inventory-detail/inventory-detail.component").then(
        (m) => m.InventoryDetailComponent
      ),
  },
  {
    path: ":id/movements",
    loadComponent: () =>
      import(
        "./components/inventory-movements/inventory-movements.component"
      ).then((m) => m.InventoryMovementsComponent),
  },
  { path: "**", redirectTo: "" },
];
