// Lógica que usa proxy.ts en cada petición:
//   1. Refresca la sesión de Supabase (renueva cookies si el token expiró).
//   2. Redirige a /login si una ruta privada se visita sin sesión.
//   3. Saca de /login y /registro a quien ya inició sesión.
//   4. Bloquea /admin a quien no tenga rol admin.
// Es una verificación "optimista": las páginas vuelven a validar en el servidor
// (lib/auth.ts) y la base de datos protege los datos con RLS.
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

const PROTECTED_PREFIXES = ["/dashboard", "/aparatos", "/habitos", "/retos", "/comunidad", "/perfil", "/admin"];
const AUTH_PAGES = ["/login", "/registro"];

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function redirectWithCookies(request: NextRequest, source: NextResponse, pathname: string, search?: Record<string, string>) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  if (search) Object.entries(search).forEach(([k, v]) => url.searchParams.set(k, v));
  const response = NextResponse.redirect(url);
  // Conserva las cookies de sesión que Supabase haya renovado
  source.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  return response;
}

export async function updateSession(request: NextRequest) {
  const { url, key } = getSupabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // IMPORTANTE: no pongas código entre createServerClient y getClaims().
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;
  const { pathname } = request.nextUrl;

  if (!userId && matches(pathname, PROTECTED_PREFIXES)) {
    return redirectWithCookies(request, response, "/login", { next: pathname });
  }

  if (userId && matches(pathname, AUTH_PAGES)) {
    return redirectWithCookies(request, response, "/dashboard");
  }

  if (userId && matches(pathname, ["/admin"])) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
    if (profile?.role !== "admin") {
      return redirectWithCookies(request, response, "/dashboard", { error: "no-autorizado" });
    }
  }

  return response;
}
