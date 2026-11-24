// Lecturas de datos para el módulo de aparatos (solo servidor).
// RLS garantiza que cada usuario solo reciba sus propios aparatos.
import { DEFAULT_CO2_KG_PER_KWH } from "@/lib/energyCalculations";
import { createClient } from "@/lib/supabase/server";
import type { Appliance, ApplianceCatalogItem, Category } from "@/types/database";

export interface ChallengeSavingsTotals {
  completed: number;
  kwh: number;
  cost: number;
  co2Kg: number;
}

export async function getCo2Factor(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("co2_kg_per_kwh").eq("id", 1).maybeSingle();
  return data ? Number(data.co2_kg_per_kwh) : DEFAULT_CO2_KG_PER_KWH;
}

/** Categorías visibles (activas). Si se indica `includeSlug`, la agrega aunque esté inactiva. */
export async function getCategories(includeSlug?: string): Promise<Category[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").order("sort_order");
  const all = (data ?? []) as Category[];
  return all.filter((c) => c.is_active || c.slug === includeSlug);
}

export async function getActiveCatalog(): Promise<ApplianceCatalogItem[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("appliance_catalog").select("*").eq("is_active", true).order("name");
  return ((data ?? []) as ApplianceCatalogItem[]).map((item) => ({
    ...item,
    default_watts: Number(item.default_watts),
    default_hours_per_day: Number(item.default_hours_per_day),
  }));
}

function normalizeAppliance(row: Appliance): Appliance {
  return {
    ...row,
    watts: Number(row.watts),
    quantity: Number(row.quantity),
    hours_per_day: Number(row.hours_per_day),
    days_per_week: Number(row.days_per_week),
  };
}

export async function getMyAppliances(userId: string): Promise<Appliance[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appliances")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error("No pudimos cargar tus aparatos. Intenta recargar la página.");
  return ((data ?? []) as Appliance[]).map(normalizeAppliance);
}

export async function getMyAppliance(userId: string, id: string): Promise<Appliance | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("appliances").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  return data ? normalizeAppliance(data as Appliance) : null;
}

/** Ahorro logrado en retos completados (lo calcula la BD en complete_challenge). */
export async function getMyChallengeSavings(userId: string): Promise<ChallengeSavingsTotals> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("challenge_participations")
    .select("savings_kwh, savings_cost, savings_co2_kg")
    .eq("user_id", userId)
    .eq("status", "completado");

  return (data ?? []).reduce<ChallengeSavingsTotals>(
    (acc, row) => ({
      completed: acc.completed + 1,
      kwh: acc.kwh + Math.max(Number(row.savings_kwh ?? 0), 0),
      cost: acc.cost + Number(row.savings_cost ?? 0),
      co2Kg: acc.co2Kg + Number(row.savings_co2_kg ?? 0),
    }),
    { completed: 0, kwh: 0, cost: 0, co2Kg: 0 },
  );
}
