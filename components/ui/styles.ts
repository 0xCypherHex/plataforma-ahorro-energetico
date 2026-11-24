// Clases reutilizables. Viven en un módulo SIN "use client" para que
// Server Components y Client Components puedan importarlas como texto normal.

export const primaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-base font-semibold text-white " +
  "shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 " +
  "focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";
