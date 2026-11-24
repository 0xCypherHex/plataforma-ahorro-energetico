// Lecturas de retos y gamificación (solo servidor). Toda la lógica de puntos,
// insignias y verificación vive en la base de datos; aquí solo se consulta.
import { callRpc } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/server";
import type {
  ActiveChallengeRow,
  Challenge,
  ChallengeParticipation,
  Level,
  MyGamification,
  PointsLedgerEntry,
} from "@/types/database";

export type ParticipationWithChallenge = ChallengeParticipation & {
  challenge: Pick<Challenge, "id" | "title" | "week_start" | "week_end" | "target_reduction_pct" | "points_reward" | "category_slug"> | null;
};

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function getActiveChallenges(): Promise<ActiveChallengeRow[]> {
  const supabase = await createClient();
  const { data, error } = await callRpc(supabase, "get_active_challenges");
  if (error) throw new Error("No pudimos cargar los retos de la semana. Intenta recargar la página.");
  return (data ?? []).map((c) => ({
    ...c,
    target_reduction_pct: Number(c.target_reduction_pct),
    points_reward: Number(c.points_reward),
    participants_count: Number(c.participants_count),
  }));
}

export async function getMyParticipations(userId: string): Promise<ParticipationWithChallenge[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("challenge_participations")
    .select(
      "*, challenge:challenges(id, title, week_start, week_end, target_reduction_pct, points_reward, category_slug)",
    )
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });
  if (error) throw new Error("No pudimos cargar tus participaciones.");

  return (data ?? []).map((row) => {
    const challenge = Array.isArray(row.challenge) ? (row.challenge[0] ?? null) : (row.challenge ?? null);
    return {
      ...(row as ChallengeParticipation),
      baseline_weekly_kwh: Number(row.baseline_weekly_kwh),
      final_weekly_kwh: num(row.final_weekly_kwh),
      savings_kwh: num(row.savings_kwh),
      savings_pct: num(row.savings_pct),
      savings_cost: num(row.savings_cost),
      savings_co2_kg: num(row.savings_co2_kg),
      points_awarded: Number(row.points_awarded),
      challenge: challenge ? { ...challenge, target_reduction_pct: Number(challenge.target_reduction_pct) } : null,
    } as ParticipationWithChallenge;
  });
}

export async function getMyGamification(): Promise<MyGamification | null> {
  const supabase = await createClient();
  const { data } = await callRpc(supabase, "get_my_gamification");
  return data;
}

export async function getLevels(): Promise<Level[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("levels").select("*").order("level");
  return (data ?? []) as Level[];
}

export async function getMyPointsHistory(userId: string, limit = 15): Promise<PointsLedgerEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("points_ledger")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as PointsLedgerEntry[];
}
