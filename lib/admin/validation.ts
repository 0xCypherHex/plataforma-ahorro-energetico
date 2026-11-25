// Validaciones del panel de administrador (mismos límites que los CHECK de schema.sql).
import { isMonday } from "@/lib/dates";
import type { ApplianceCatalogItem, Category, ChallengeInsert } from "@/types/database";

type Errors<K extends string> = Partial<Record<K, string>>;
export type Validation<T, K extends string> = { ok: true; data: T } | { ok: false; errors: Errors<K> };

function num(value: string) {
  const cleaned = value.trim().replace(",", ".");
  return cleaned === "" ? Number.NaN : Number(cleaned);
}

// ---------------------------------------------------------------------------
// Retos
// ---------------------------------------------------------------------------
export interface ChallengeFormValues {
  title: string;
  description: string;
  tips: string;
  category_slug: string;
  target_reduction_pct: string;
  points_reward: string;
  week_start: string;
  is_active: boolean;
}

export function validateChallenge(
  v: ChallengeFormValues,
  validCategories: string[],
): Validation<Required<ChallengeInsert>, keyof ChallengeFormValues> {
  const errors: Errors<keyof ChallengeFormValues> = {};
  const title = v.title.trim();
  const description = v.description.trim();
  const tips = v.tips.trim();
  const target = num(v.target_reduction_pct);
  const points = num(v.points_reward);

  if (title.length < 3 || title.length > 120) errors.title = "El título debe tener entre 3 y 120 caracteres.";
  if (description.length < 10 || description.length > 2000)
    errors.description = "La descripción debe tener entre 10 y 2000 caracteres.";
  if (tips.length > 2000) errors.tips = "Máximo 2000 caracteres.";
  if (v.category_slug && !validCategories.includes(v.category_slug)) errors.category_slug = "Elige una categoría válida.";
  if (!Number.isFinite(target) || target <= 0 || target > 100) errors.target_reduction_pct = "La meta debe ser mayor a 0 y máximo 100 %.";
  if (!Number.isInteger(points) || points < 0 || points > 1000) errors.points_reward = "Los puntos deben ser un entero de 0 a 1000.";
  if (!isMonday(v.week_start)) errors.week_start = "La semana debe empezar en lunes.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      title,
      description,
      tips: tips || null,
      category_slug: v.category_slug || null,
      target_reduction_pct: Math.round(target * 100) / 100,
      points_reward: points,
      week_start: v.week_start,
      is_active: v.is_active,
    },
  };
}

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------
export interface CategoryFormValues {
  slug: string;
  name: string;
  icon: string;
  sort_order: string;
}

export function validateCategory(
  v: CategoryFormValues,
  options: { isNew: boolean; existingSlugs: string[] },
): Validation<Pick<Category, "slug" | "name" | "icon" | "sort_order">, keyof CategoryFormValues> {
  const errors: Errors<keyof CategoryFormValues> = {};
  const slug = v.slug.trim().toLowerCase();
  const name = v.name.trim();
  const icon = v.icon.trim();
  const order = num(v.sort_order);

  if (options.isNew) {
    if (!/^[a-z0-9_]{2,40}$/.test(slug)) errors.slug = "Usa de 2 a 40 letras minúsculas, números o guion bajo (sin acentos).";
    else if (options.existingSlugs.includes(slug)) errors.slug = "Ya existe una categoría con ese identificador.";
  }
  if (name.length < 2 || name.length > 60) errors.name = "El nombre debe tener entre 2 y 60 caracteres.";
  if ([...icon].length > 4) errors.icon = "Usa un solo emoji.";
  if (!Number.isInteger(order) || order < 0 || order > 10000) errors.sort_order = "Escribe un entero de 0 a 10000.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data: { slug, name, icon: icon || null, sort_order: order } };
}

/** Sugerencia de identificador a partir del nombre: "Lavandería y más" → "lavanderia_y_mas". */
export function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

// ---------------------------------------------------------------------------
// Catálogo de aparatos
// ---------------------------------------------------------------------------
export interface CatalogFormValues {
  name: string;
  category_slug: string;
  default_watts: string;
  default_hours_per_day: string;
  default_days_per_week: string;
  description: string;
  is_active: boolean;
}

type CatalogData = Pick<
  ApplianceCatalogItem,
  "name" | "category_slug" | "default_watts" | "default_hours_per_day" | "default_days_per_week" | "description" | "is_active"
>;

export function validateCatalogItem(v: CatalogFormValues, validCategories: string[]): Validation<CatalogData, keyof CatalogFormValues> {
  const errors: Errors<keyof CatalogFormValues> = {};
  const name = v.name.trim();
  const watts = num(v.default_watts);
  const hours = num(v.default_hours_per_day);
  const days = num(v.default_days_per_week);
  const description = v.description.trim();

  if (name.length < 2 || name.length > 100) errors.name = "El nombre debe tener entre 2 y 100 caracteres.";
  if (!validCategories.includes(v.category_slug)) errors.category_slug = "Elige una categoría.";
  if (!Number.isFinite(watts) || watts <= 0 || watts > 20000) errors.default_watts = "La potencia debe ser mayor a 0 y máximo 20 000 W.";
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) errors.default_hours_per_day = "Las horas deben estar entre 0 y 24.";
  if (!Number.isInteger(days) || days < 0 || days > 7) errors.default_days_per_week = "Los días deben ser un entero de 0 a 7.";
  if (description.length > 500) errors.description = "Máximo 500 caracteres.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      name,
      category_slug: v.category_slug,
      default_watts: Math.round(watts * 100) / 100,
      default_hours_per_day: Math.round(hours * 100) / 100,
      default_days_per_week: days,
      description: description || null,
      is_active: v.is_active,
    },
  };
}
