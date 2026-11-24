// Lecturas de hábitos (solo servidor). RLS limita los resultados al usuario actual.
import { createClient } from "@/lib/supabase/server";
import type { HabitLog } from "@/types/database";

export async function getMyHabits(userId: string, sinceDate: string): Promise<HabitLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("habit_logs")
    .select("*")
    .eq("user_id", userId)
    .gte("log_date", sinceDate)
    .order("log_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error("No pudimos cargar tus hábitos. Intenta recargar la página.");
  return ((data ?? []) as HabitLog[]).map((h) => ({
    ...h,
    item_count: Number(h.item_count),
    watts_per_item: h.watts_per_item === null ? null : Number(h.watts_per_item),
    hours_per_day: Number(h.hours_per_day),
    days_per_week: Number(h.days_per_week),
  }));
}
