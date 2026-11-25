// Lecturas del panel de administrador (solo servidor). Las políticas RLS dejan ver
// también los registros inactivos únicamente a usuarios con rol admin.
import { callRpc } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/server";
import type { AdminUserRow, ApplianceCatalogItem, Category, Challenge } from "@/types/database";

export type ChallengeWithStats = Challenge & { participants: number; completed: number };

export async function getAllChallenges(): Promise<ChallengeWithStats[]> {
  const supabase = await createClient();
  const [{ data: challenges, error }, { data: parts }] = await Promise.all([
    supabase.from("challenges").select("*").order("week_start", { ascending: false }).order("created_at"),
    supabase.from("challenge_participations").select("challenge_id, status"),
  ]);
  if (error) throw new Error("No pudimos cargar los retos.");

  const stats = new Map<string, { participants: number; completed: number }>();
  for (const p of parts ?? []) {
    const s = stats.get(p.challenge_id) ?? { participants: 0, completed: 0 };
    if (p.status !== "abandonado") s.participants += 1;
    if (p.status === "completado") s.completed += 1;
    stats.set(p.challenge_id, s);
  }
  return ((challenges ?? []) as Challenge[]).map((c) => ({
    ...c,
    target_reduction_pct: Number(c.target_reduction_pct),
    ...(stats.get(c.id) ?? { participants: 0, completed: 0 }),
  }));
}

export async function getChallenge(id: string): Promise<Challenge | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("challenges").select("*").eq("id", id).maybeSingle();
  return data ? ({ ...data, target_reduction_pct: Number(data.target_reduction_pct) } as Challenge) : null;
}

export type CategoryWithUsage = Category & { catalogCount: number; applianceCount: number };

export async function getAllCategories(): Promise<CategoryWithUsage[]> {
  const supabase = await createClient();
  const [{ data: categories }, { data: catalog }, { data: appliances }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("appliance_catalog").select("category_slug"),
    supabase.from("appliances").select("category_slug"),
  ]);
  const count = (rows: { category_slug: string }[] | null, slug: string) => (rows ?? []).filter((r) => r.category_slug === slug).length;
  return ((categories ?? []) as Category[]).map((c) => ({
    ...c,
    catalogCount: count(catalog, c.slug),
    applianceCount: count(appliances, c.slug),
  }));
}

export async function getCategory(slug: string): Promise<Category | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").eq("slug", slug).maybeSingle();
  return (data as Category) ?? null;
}

export async function getCatalog(filters: { category?: string; q?: string }): Promise<ApplianceCatalogItem[]> {
  const supabase = await createClient();
  let query = supabase.from("appliance_catalog").select("*").order("category_slug").order("name");
  if (filters.category) query = query.eq("category_slug", filters.category);
  if (filters.q) query = query.ilike("name", `%${filters.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  const { data } = await query;
  return ((data ?? []) as ApplianceCatalogItem[]).map((i) => ({
    ...i,
    default_watts: Number(i.default_watts),
    default_hours_per_day: Number(i.default_hours_per_day),
  }));
}

export async function getCatalogItem(id: string): Promise<ApplianceCatalogItem | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("appliance_catalog").select("*").eq("id", id).maybeSingle();
  return data
    ? ({ ...data, default_watts: Number(data.default_watts), default_hours_per_day: Number(data.default_hours_per_day) } as ApplianceCatalogItem)
    : null;
}

export async function listUsers(search: string): Promise<AdminUserRow[]> {
  const supabase = await createClient();
  const { data, error } = await callRpc(supabase, "admin_list_users", { p_search: search || null, p_limit: 200 });
  if (error) throw new Error(error.message);
  return data ?? [];
}
