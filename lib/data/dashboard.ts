// Datos para las gráficas del panel (solo servidor).
import { callRpc } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/server";
import type { CommunityStats, ConsumptionSnapshot, SavingsHistoryRow } from "@/types/database";

export async function getMySnapshots(userId: string, sinceDate: string): Promise<ConsumptionSnapshot[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("consumption_snapshots")
    .select("*")
    .eq("user_id", userId)
    .gte("snapshot_date", sinceDate)
    .order("snapshot_date", { ascending: true });
  return ((data ?? []) as ConsumptionSnapshot[]).map((s) => ({
    ...s,
    monthly_kwh: Number(s.monthly_kwh),
    monthly_cost: Number(s.monthly_cost),
    appliance_count: Number(s.appliance_count),
  }));
}

export async function getMySavingsHistory(weeks = 12): Promise<SavingsHistoryRow[]> {
  const supabase = await createClient();
  const { data } = await callRpc(supabase, "get_my_savings_history", { p_weeks: weeks });
  return (data ?? []).map((r) => ({
    ...r,
    savings_kwh: Number(r.savings_kwh),
    savings_cost: Number(r.savings_cost),
    savings_co2_kg: Number(r.savings_co2_kg),
    completed_challenges: Number(r.completed_challenges),
  }));
}

/** Estadísticas de la comunidad del usuario, o de toda la plataforma si no tiene comunidad. */
export async function getCommunityStats(communityId: string | null): Promise<CommunityStats | null> {
  const supabase = await createClient();
  const { data } = await callRpc(supabase, "get_community_stats", { p_community_id: communityId });
  return data;
}
