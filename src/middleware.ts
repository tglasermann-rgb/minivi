import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Protege /app/* y /kiosk/*: sin sesión → /login.
 * El rol (owner vs kiosk) se verifica en los layouts de cada zona con Prisma,
 * porque el middleware corre en Edge y no puede consultar la base.
 *
 * Validar la sesión cuesta una llamada de red a Supabase, así que solo se hace
 * cuando sirve: en las rutas protegidas y en /login. Las rutas de API se
 * autentican por su cuenta (webhooks con HMAC, crons con CRON_SECRET).
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = pathname.startsWith("/app") || pathname.startsWith("/kiosk");
  const isLogin = pathname === "/login";
  if (!isProtected && !isLogin && pathname !== "/") return NextResponse.next();

  // Sin cookie de sesión no hace falta preguntarle a Supabase: no hay usuario.
  const hasSessionCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  if (!hasSessionCookie) {
    if (isProtected) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const { response, user } = await updateSession(request);

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isLogin && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Solo las rutas donde la sesión importa. Fuera quedan /api/*, los archivos
  // estáticos y todo lo que Next sirve desde su caché.
  matcher: ["/", "/login", "/app/:path*", "/kiosk/:path*"],
};
