import { Routes } from "@angular/router";
// Si aún quieres redirigir desde '' a orders, ya no necesitas un guard.

export const dashboardRoutes: Routes = [
  {
    path: "",
    loadComponent: () =>
      import("./dashboard.component").then((m) => m.DashboardComponent),

    // 👇 Todas las secciones viven dentro del shell
    children: [
      { path: "", pathMatch: "full", redirectTo: "orders" }, // default

      {
        path: "appointments",
        loadChildren: () =>
          import("./appointments/appointments.routing").then(
            (m) => m.appointmentsRoutes
          ),
      },
      {
        path: "orders",
        loadChildren: () =>
          import("./orders/orders.routing").then((m) => m.OrdersRoutes),
        data: { showTab: true },
      },
      {
        path: "customers",
        loadChildren: () =>
          import("./customers/customers.routing").then(
            (m) => m.customersRoutes
          ),
        data: { showTab: true },
      },
      {
        path: "patients",
        loadChildren: () =>
          import("./patients/patients.routing").then((m) => m.patientsRoutes),
        data: { showTab: true },
      },
      {
        path: "products",
        loadChildren: () =>
          import("./products/products.routing").then((m) => m.productsRoutes),
        data: { showTab: true },
      },
      {
        path: "inventory",
        loadChildren: () =>
          import("./inventory/inventory.routing").then(
            (m) => m.inventoryRoutes
          ),
        data: { showTab: true },
      },
      {
        path: "supplier",
        loadChildren: () =>
          import("./supplier/supplier.routing").then((m) => m.suppliersRoutes),
        data: { showTab: true },
      },
      {
        path: "movements",
        loadChildren: () =>
          import("./movements/movements.routing").then(
            (m) => m.movementsRoutes
          ),
        data: { showTab: true },
      },
    ],
  },
];
