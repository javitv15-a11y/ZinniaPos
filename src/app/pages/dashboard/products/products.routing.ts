import { Routes } from "@angular/router";
import { ProductManagementComponent } from "./components/product-management/product-management.component";
import { InitialSettingComponent } from "./components/initial-setting/initial-setting.component";
import { ProductAddComponent } from "./components/product-add/product-add.component";
import { ProductCategoryComponent } from "./components/product-category/product-category.component";
import { ProductCategoryManagementComponent } from "./components/product-category/product-category-management/product-category-management.component";

export const productsRoutes: Routes = [
  { path: "", redirectTo: "product-management", pathMatch: "full" },

  {
    path: "initial-setting",
    component: InitialSettingComponent,
    data: { showTab: true, title: "Productos" },
  },
  {
    path: "product-management",
    component: ProductManagementComponent,
    data: { showTab: true, title: "Productos" },
  },

  { path: "product-add", component: ProductAddComponent },
  { path: "product-category", component: ProductCategoryComponent },

  { path: "product-category-management", component: ProductCategoryManagementComponent },

  {
    path: ":id",
    loadComponent: () =>
      import("./components/product-detail/product-detail.component").then(
        (m) => m.ProductDetailComponent
      ),
  },

  {
    path: "product-managament",
    redirectTo: "product-management",
    pathMatch: "full",
  },
];
