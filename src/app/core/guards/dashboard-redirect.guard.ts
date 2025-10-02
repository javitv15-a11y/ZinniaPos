import { Injectable } from "@angular/core";
import { CanActivate, Router } from "@angular/router";
import { AuthSessionService } from "../services/utils/auth-session.service";
import { BusinessCategoryId } from "../consts/enums/business/business-category.enum";

@Injectable({ providedIn: 'root' })
export class DashboardRedirectGuard implements CanActivate {
  constructor(
    private router: Router,
    private authSessionService: AuthSessionService
  ) {}

  canActivate(): boolean {
    const userCompany = this.authSessionService.getUserCompany();

    if (userCompany) {
      switch (userCompany.category) {
        case BusinessCategoryId.HEALTH:
          this.router.navigate(['/dashboard/appointments']);
          return false;
        case BusinessCategoryId.RETAIL:
          this.router.navigate(['/dashboard/orders']);
          return false;
        default:
          this.router.navigate(['/not-authorized']);
          return false;
      }
    }
    // Si aún no hay company cargada, deja ver el DashboardComponent o
    // podrías retornar false y esperar a un resolver, según tu diseño.
    return true;
  }
}
