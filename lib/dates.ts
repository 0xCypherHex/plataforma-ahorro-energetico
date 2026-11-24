// Utilidades de fecha en la zona horaria de la plataforma (puro, sin dependencias).
export const PLATFORM_TIMEZONE = "America/Mexico_City";

/** Fecha de hoy 'YYYY-MM-DD' en la zona horaria indicada (igual que app_today() en SQL). */
export function todayIn(timeZone = PLATFORM_TIMEZONE, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Suma (o resta) días a una fecha 'YYYY-MM-DD'. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** '2026-11-24' → '24 nov 2026' */
export function formatDate(date: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("es-MX", { timeZone: "UTC", ...options });
}
