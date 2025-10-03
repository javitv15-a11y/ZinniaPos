import { inject } from "@angular/core";
import {
  CanMatchFn,
  Router,
  UrlTree,
  UrlSegment,
  Route,
} from "@angular/router";
import { AuthSessionService } from "../../services/utils/auth-session.service";

/** Bloquea la carga de /dashboard si no hay sesión y envía ?returnUrl=... */
export const AuthCanMatchGuard: CanMatchFn = (
  route: Route,
  segments: UrlSegment[]
): boolean | UrlTree => {
  const auth = inject(AuthSessionService);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;

  const attemptedUrl = "/" + segments.map((s) => s.path).join("/");
  return router.createUrlTree(["/login"], {
    queryParams: { returnUrl: attemptedUrl },
  });
};
