// Clasificaciones (solo servidor). Los rankings los calcula la BD con get_leaderboard
// y get_community_ranking; aquí solo se normalizan los números.
import { callRpc } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/server";
import type { CommunityRankingRow, LeaderboardRow, LeaderboardScope } from "@/types/database";

export async function getLeaderboard(scope: LeaderboardScope, days = 30, limit = 20): Promise<LeaderboardRow[]> {
  const supabase = await createClient();
  const { data } = await callRpc(supabase, "get_leaderboard", { p_scope: scope, p_days: days, p_limit: limit });
  return (data ?? []).map((r) => ({
    ...r,
    rank: Number(r.rank),
    avg_savings_pct: Number(r.avg_savings_pct),
    total_savings_kwh: Number(r.total_savings_kwh),
    completed_challenges: Number(r.completed_challenges),
  }));
}

export async function getCommunityRanking(days = 30, limit = 20): Promise<CommunityRankingRow[]> {
  const supabase = await createClient();
  const { data } = await callRpc(supabase, "get_community_ranking", { p_days: days, p_limit: limit });
  return (data ?? []).map((r) => ({
    ...r,
    rank: Number(r.rank),
    participants: Number(r.participants),
    avg_savings_pct: Number(r.avg_savings_pct),
    total_savings_kwh: Number(r.total_savings_kwh),
    total_savings_cost: Number(r.total_savings_cost),
    total_savings_co2_kg: Number(r.total_savings_co2_kg),
    gold_awards: Number(r.gold_awards),
    total_awards: Number(r.total_awards),
  }));
}
