// Formateadores en español de México (sin dependencias de Next.js).

const numberFmt = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });
const currencyFmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function formatNumber(value: number | null | undefined, maxDecimals = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "0";
  if (maxDecimals === 2) return numberFmt.format(value);
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: maxDecimals }).format(value);
}

export function formatCurrency(value: number | null | undefined) {
  return currencyFmt.format(value ?? 0);
}

export const ACCOUNT_TYPE_LABELS = {
  hogar: "Hogar",
  negocio: "Pequeño negocio",
} as const;

export const ROLE_LABELS = {
  user: "Usuario",
  admin: "Administrador",
} as const;
