// Cliente de Supabase para Server Components, Server Actions y Route Handlers.
// Crea uno nuevo en cada petición (nunca lo guardes en una variable global).
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

export async function createClient() {
  const { url, key } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Llamado desde un Server Component: ahí no se pueden escribir cookies.
          // No pasa nada porque proxy.ts ya refresca la sesión en cada petición.
        }
      },
    },
  });
}
