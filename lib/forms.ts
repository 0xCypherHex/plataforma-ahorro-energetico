// Tipos y utilidades compartidas por los formularios con Server Actions.

export interface FormState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

export const initialFormState: FormState = { status: "idle" };

export const NEW_COMMUNITY_VALUE = "__nueva__";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isUuid(value: string) {
  return UUID_RE.test(value);
}

export function isEmail(value: string) {
  return EMAIL_RE.test(value);
}

/** Lee un campo de texto de un FormData (siempre devuelve string recortado). */
export function readText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Acepta solo rutas internas ("/algo") para evitar redirecciones a otros sitios. */
export function safeRedirectPath(value: string, fallback = "/dashboard") {
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

interface AuthErrorLike {
  message: string;
  code?: string;
  status?: number;
  name?: string;
}

/** Traduce los errores de Supabase Auth al español. En desarrollo agrega el detalle técnico. */
export function translateAuthError(error: AuthErrorLike) {
  const m = (error.message ?? "").toLowerCase();
  const code = error.code ?? "";
  let friendly: string;

  if (code === "invalid_credentials" || m.includes("invalid login credentials")) {
    friendly = "Correo o contraseña incorrectos.";
  } else if (code === "email_not_confirmed" || m.includes("email not confirmed")) {
    friendly = "Tu correo no está confirmado. En Supabase → Authentication → Users, confirma el usuario.";
  } else if (code === "user_already_exists" || m.includes("already registered") || m.includes("already been registered")) {
    friendly = "Ya existe una cuenta con ese correo. Inicia sesión.";
  } else if (code === "weak_password" || m.includes("password should be at least")) {
    friendly = "La contraseña es demasiado débil o corta.";
  } else if (code.startsWith("over_") || m.includes("rate limit") || m.includes("too many")) {
    friendly = "Demasiados intentos. Espera unos minutos y vuelve a intentar.";
  } else if (code === "signup_disabled" || m.includes("signups not allowed")) {
    friendly = "El registro está deshabilitado en este momento.";
  } else if (m.includes("invalid api key") || m.includes("no api key")) {
    friendly = "La clave de Supabase no es válida. Revisa NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local.";
  } else if (m.includes("fetch failed") || error.name === "AuthRetryableFetchError" || error.status === 0) {
    friendly = "No se pudo conectar con Supabase. Revisa NEXT_PUBLIC_SUPABASE_URL y tu conexión a internet.";
  } else {
    friendly = "Ocurrió un error inesperado. Intenta de nuevo.";
  }

  if (process.env.NODE_ENV === "development") {
    return `${friendly} [detalle: ${error.message}${code ? ` · ${code}` : ""}${error.status ? ` · HTTP ${error.status}` : ""}]`;
  }
  return friendly;
}
