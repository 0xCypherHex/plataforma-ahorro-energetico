/**
 * lib/energyCalculations.ts — Fórmulas de energía, costo y CO2 (COMPARTIDO Web + Móvil).
 *
 *   · TypeScript puro: solo importa TIPOS de ../types/database (ruta relativa,
 *     para que funcione igual en Expo sin configurar alias "@/").
 *   · Las fórmulas son IDÉNTICAS a las funciones SQL de supabase/schema.sql:
 *
 *       kWh_semana = (W × cantidad × horas_día × días_semana) / 1000
 *       kWh_día    = kWh_semana / 7
 *       kWh_mes    = kWh_semana × 52 / 12
 *       kWh_año    = kWh_semana × 52
 *       costo      = kWh × tarifa ($/kWh)
 *       CO2 (kg)   = kWh × factor (kg CO2e/kWh)
 *
 *   · Redondeo igual que las RPC: kWh a 3 decimales, dinero a 2, CO2 a 3.
 */
import type { Appliance, ApplianceInsert, Category, HabitLog, HabitType, Period } from "../types/database";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------
export const WEEKS_PER_YEAR = 52;
export const MONTHS_PER_YEAR = 12;
export const DAYS_PER_WEEK = 7;
/** Semanas promedio por mes (52 / 12 ≈ 4.333). */
export const WEEKS_PER_MONTH = WEEKS_PER_YEAR / MONTHS_PER_YEAR;
/** Factor de emisión del Sistema Eléctrico Nacional (SEMARNAT 2024). Úsalo solo si no tienes app_settings. */
export const DEFAULT_CO2_KG_PER_KWH = 0.444;
export const DEFAULT_TARIFF_HOGAR = 1.2;
export const DEFAULT_TARIFF_NEGOCIO = 4.0;

/** Potencia por defecto (W) que usa la BD para hábitos sin watts_per_item. */
export const HABIT_DEFAULT_WATTS: Record<Exclude<HabitType, "uso_aparato">, number> = {
  luces_sin_necesidad: 15,
  dispositivos_standby: 5,
};

/** Límites iguales a los CHECK de la tabla `appliances`. */
export const APPLIANCE_LIMITS = {
  nameMax: 100,
  wattsMin: 0.01,
  wattsMax: 20000,
  quantityMin: 1,
  quantityMax: 500,
  hoursMin: 0,
  hoursMax: 24,
  daysMin: 0,
  daysMax: 7,
} as const;

export const PERIOD_LABELS: Record<Period, string> = {
  diario: "Diario",
  semanal: "Semanal",
  mensual: "Mensual",
  anual: "Anual",
};

// ---------------------------------------------------------------------------
// Tipos de resultado
// ---------------------------------------------------------------------------
export type PeriodValues = Record<Period, number>;

export interface ConsumptionBreakdown {
  kwh: PeriodValues;
  cost: PeriodValues;
  co2Kg: PeriodValues;
}

/** Lo mínimo que necesita la fórmula (sirve para filas de BD o formularios). */
export type ApplianceUsage = Pick<Appliance, "watts" | "quantity" | "hours_per_day" | "days_per_week">;

export interface ApplianceConsumption extends ConsumptionBreakdown {
  appliance: Appliance;
  /** Porcentaje del consumo total del usuario (0–100). */
  share: number;
}

export interface CategoryConsumption extends ConsumptionBreakdown {
  categorySlug: string;
  categoryName: string;
  icon: string | null;
  applianceCount: number;
  share: number;
}

export interface SavingsResult {
  /** kWh ahorrados por semana (negativo si el consumo subió). */
  weeklyKwh: number;
  /** Porcentaje de reducción respecto al "antes". */
  pct: number;
  /** Ahorro semanal en dinero (0 si no hubo ahorro). */
  weeklyCost: number;
  /** CO2 evitado por semana en kg (0 si no hubo ahorro). */
  weeklyCo2Kg: number;
  /** Proyecciones del ahorro a otros periodos. */
  kwh: PeriodValues;
  cost: PeriodValues;
  co2Kg: PeriodValues;
}

// ---------------------------------------------------------------------------
// Utilidades numéricas
// ---------------------------------------------------------------------------
/** Redondea a `decimals` decimales (mitades hacia arriba, como ROUND de PostgreSQL para positivos). */
export function round(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.round((Math.abs(value) + Number.EPSILON) * factor)) / factor;
}

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function mapPeriods(values: PeriodValues, fn: (v: number) => number): PeriodValues {
  return { diario: fn(values.diario), semanal: fn(values.semanal), mensual: fn(values.mensual), anual: fn(values.anual) };
}

// ---------------------------------------------------------------------------
// Fórmulas base
// ---------------------------------------------------------------------------
/** kWh por día de uso para UN aparato: (W × horas) / 1000 — la fórmula del enunciado. */
export function kwhPerUseDay(watts: number, hoursPerDay: number): number {
  return (toNumber(watts) * toNumber(hoursPerDay)) / 1000;
}

/** kWh por SEMANA de un aparato, escalado por cantidad y días de uso. */
export function weeklyKwh(usage: ApplianceUsage): number {
  return (
    (toNumber(usage.watts) * toNumber(usage.quantity) * toNumber(usage.hours_per_day) * toNumber(usage.days_per_week)) /
    1000
  );
}

/** Convierte kWh semanales a los 4 periodos (sin redondear). */
export function periodsFromWeekly(weekly: number): PeriodValues {
  return {
    diario: weekly / DAYS_PER_WEEK,
    semanal: weekly,
    mensual: weekly * WEEKS_PER_MONTH,
    anual: weekly * WEEKS_PER_YEAR,
  };
}

/** kWh, costo y CO2 en los 4 periodos a partir de kWh semanales (ya redondeados). */
export function breakdownFromWeekly(weekly: number, tariffPerKwh: number, co2KgPerKwh = DEFAULT_CO2_KG_PER_KWH): ConsumptionBreakdown {
  const kwh = periodsFromWeekly(weekly);
  return {
    kwh: mapPeriods(kwh, (v) => round(v, 3)),
    cost: mapPeriods(kwh, (v) => round(v * toNumber(tariffPerKwh), 2)),
    co2Kg: mapPeriods(kwh, (v) => round(v * toNumber(co2KgPerKwh), 3)),
  };
}

/** Consumo de un solo aparato (o de los datos de un formulario). */
export function calculateApplianceBreakdown(
  usage: ApplianceUsage,
  tariffPerKwh: number,
  co2KgPerKwh = DEFAULT_CO2_KG_PER_KWH,
): ConsumptionBreakdown {
  return breakdownFromWeekly(weeklyKwh(usage), tariffPerKwh, co2KgPerKwh);
}

/** kWh semanales totales de una lista de aparatos. */
export function totalWeeklyKwh(appliances: ApplianceUsage[]): number {
  return appliances.reduce((sum, a) => sum + weeklyKwh(a), 0);
}

/** Totales del hogar/negocio. Coincide con la RPC get_my_consumption_summary. */
export function calculateTotals(
  appliances: ApplianceUsage[],
  tariffPerKwh: number,
  co2KgPerKwh = DEFAULT_CO2_KG_PER_KWH,
): ConsumptionBreakdown {
  return breakdownFromWeekly(totalWeeklyKwh(appliances), tariffPerKwh, co2KgPerKwh);
}

/** Consumo por aparato, ordenado de mayor a menor, con su porcentaje del total. */
export function breakdownByAppliance(
  appliances: Appliance[],
  tariffPerKwh: number,
  co2KgPerKwh = DEFAULT_CO2_KG_PER_KWH,
): ApplianceConsumption[] {
  const total = totalWeeklyKwh(appliances);
  return appliances
    .map((appliance) => ({ appliance, weekly: weeklyKwh(appliance) }))
    .sort((a, b) => b.weekly - a.weekly)
    .map(({ appliance, weekly }) => ({
      appliance,
      ...breakdownFromWeekly(weekly, tariffPerKwh, co2KgPerKwh),
      share: total > 0 ? round((weekly / total) * 100, 2) : 0,
    }));
}

/** Consumo agrupado por categoría (coincide con get_my_consumption_by_category). */
export function breakdownByCategory(
  appliances: Appliance[],
  categories: Pick<Category, "slug" | "name" | "icon">[],
  tariffPerKwh: number,
  co2KgPerKwh = DEFAULT_CO2_KG_PER_KWH,
): CategoryConsumption[] {
  const total = totalWeeklyKwh(appliances);
  const groups = new Map<string, { weekly: number; count: number }>();

  for (const a of appliances) {
    const g = groups.get(a.category_slug) ?? { weekly: 0, count: 0 };
    g.weekly += weeklyKwh(a);
    g.count += 1;
    groups.set(a.category_slug, g);
  }

  return [...groups.entries()]
    .sort((x, y) => y[1].weekly - x[1].weekly)
    .map(([slug, g]) => {
      const category = categories.find((c) => c.slug === slug);
      return {
        categorySlug: slug,
        categoryName: category?.name ?? slug,
        icon: category?.icon ?? null,
        applianceCount: g.count,
        ...breakdownFromWeekly(g.weekly, tariffPerKwh, co2KgPerKwh),
        share: total > 0 ? round((g.weekly / total) * 100, 2) : 0,
      };
    });
}

/**
 * Ahorro entre un consumo semanal "antes" y "después".
 * Misma lógica que la RPC complete_challenge (costo y CO2 solo cuentan ahorro positivo).
 */
export function calculateSavings(
  beforeWeeklyKwh: number,
  afterWeeklyKwh: number,
  tariffPerKwh: number,
  co2KgPerKwh = DEFAULT_CO2_KG_PER_KWH,
): SavingsResult {
  const diff = toNumber(beforeWeeklyKwh) - toNumber(afterWeeklyKwh);
  const positive = Math.max(diff, 0);
  const periods = periodsFromWeekly(positive);
  return {
    weeklyKwh: round(diff, 3),
    pct: beforeWeeklyKwh > 0 ? round((diff / beforeWeeklyKwh) * 100, 2) : 0,
    weeklyCost: round(positive * toNumber(tariffPerKwh), 2),
    weeklyCo2Kg: round(positive * toNumber(co2KgPerKwh), 3),
    kwh: mapPeriods(periods, (v) => round(v, 3)),
    cost: mapPeriods(periods, (v) => round(v * toNumber(tariffPerKwh), 2)),
    co2Kg: mapPeriods(periods, (v) => round(v * toNumber(co2KgPerKwh), 3)),
  };
}

/** kWh semanales asociados a un hábito (desperdicio o uso real). */
export function habitWeeklyKwh(
  habit: Pick<HabitLog, "habit_type" | "item_count" | "watts_per_item" | "hours_per_day" | "days_per_week">,
  applianceWatts?: number,
): number {
  const watts =
    habit.watts_per_item ??
    (habit.habit_type === "uso_aparato" ? toNumber(applianceWatts) : HABIT_DEFAULT_WATTS[habit.habit_type]);
  return weeklyKwh({
    watts,
    quantity: habit.item_count,
    hours_per_day: habit.hours_per_day,
    days_per_week: habit.days_per_week,
  });
}

/** Árboles adultos equivalentes que absorben ese CO2 en un año (≈ 22 kg CO2/árbol/año). Solo ilustrativo. */
export function treesEquivalent(co2KgPerYear: number): number {
  return round(Math.max(co2KgPerYear, 0) / 22, 1);
}

// ---------------------------------------------------------------------------
// Validación de un aparato (mismos límites que la BD)
// ---------------------------------------------------------------------------
export interface ApplianceFormValues {
  name: string;
  category_slug: string;
  watts: string | number;
  quantity: string | number;
  hours_per_day: string | number;
  days_per_week: string | number;
  catalog_id?: string | null;
}

export type ApplianceValidation =
  | { ok: true; data: ApplianceInsert }
  | { ok: false; errors: Partial<Record<keyof ApplianceFormValues, string>> };

function parseDecimal(value: string | number): number {
  if (typeof value === "number") return value;
  const cleaned = value.trim().replace(",", ".");
  return cleaned === "" ? Number.NaN : Number(cleaned);
}

export function validateAppliance(values: ApplianceFormValues, validCategorySlugs?: string[]): ApplianceValidation {
  const L = APPLIANCE_LIMITS;
  const errors: Partial<Record<keyof ApplianceFormValues, string>> = {};
  const name = String(values.name ?? "").trim();
  const category = String(values.category_slug ?? "").trim();
  const watts = parseDecimal(values.watts);
  const quantity = parseDecimal(values.quantity);
  const hours = parseDecimal(values.hours_per_day);
  const days = parseDecimal(values.days_per_week);

  if (name.length < 1 || name.length > L.nameMax) errors.name = `Escribe un nombre (máx. ${L.nameMax} caracteres).`;
  if (!category || (validCategorySlugs && !validCategorySlugs.includes(category)))
    errors.category_slug = "Elige una categoría.";
  if (!Number.isFinite(watts) || watts < L.wattsMin || watts > L.wattsMax)
    errors.watts = "La potencia debe ser mayor a 0 y máximo 20 000 W.";
  if (!Number.isInteger(quantity) || quantity < L.quantityMin || quantity > L.quantityMax)
    errors.quantity = `Escribe un número entero entre ${L.quantityMin} y ${L.quantityMax}.`;
  if (!Number.isFinite(hours) || hours < L.hoursMin || hours > L.hoursMax)
    errors.hours_per_day = "Las horas deben estar entre 0 y 24.";
  if (!Number.isInteger(days) || days < L.daysMin || days > L.daysMax)
    errors.days_per_week = "Los días deben ser un número entero entre 0 y 7.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      name,
      category_slug: category,
      watts: round(watts, 2),
      quantity,
      hours_per_day: round(hours, 2),
      days_per_week: days,
      catalog_id: values.catalog_id ? values.catalog_id : null,
    },
  };
}
