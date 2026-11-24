/**
 * types/database.ts — Contrato de datos COMPARTIDO (Web Next.js + Móvil Expo).
 *
 * Reglas de este archivo:
 *   · TypeScript puro: cero imports (ni de Next.js, ni de React, ni del navegador).
 *   · Refleja exactamente supabase/schema.sql y docs/INTEGRACION_MOVIL.md.
 *   · Se copia tal cual al proyecto de React Native.
 *
 * Convenciones: los `numeric` de PostgreSQL llegan como `number`, las fechas `date`
 * como string 'YYYY-MM-DD' y los `timestamptz` como string ISO 8601.
 */

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
export type UUID = string;
/** 'YYYY-MM-DD' */
export type DateString = string;
/** ISO 8601, p. ej. '2026-11-24T18:30:00.000Z' */
export type TimestampString = string;

// ---------------------------------------------------------------------------
// Enums (valores permitidos). Los arreglos sirven para selects y validaciones.
// ---------------------------------------------------------------------------
export const ACCOUNT_TYPES = ["hogar", "negocio"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PARTICIPATION_STATUSES = ["activo", "completado", "abandonado"] as const;
export type ParticipationStatus = (typeof PARTICIPATION_STATUSES)[number];

export const VERIFICATION_SOURCES = ["manual", "enchufe_inteligente", "medidor_inteligente"] as const;
export type VerificationSource = (typeof VERIFICATION_SOURCES)[number];

export const HABIT_TYPES = ["luces_sin_necesidad", "dispositivos_standby", "uso_aparato"] as const;
export type HabitType = (typeof HABIT_TYPES)[number];

export const POINTS_REASONS = [
  "reto_completado",
  "avance_registrado",
  "habito_registrado",
  "insignia",
  "racha",
  "ajuste_admin",
] as const;
export type PointsReason = (typeof POINTS_REASONS)[number];

export const BADGE_CRITERIA = [
  "retos_completados",
  "puntos_totales",
  "aparatos_registrados",
  "habitos_registrados",
  "ahorro_kwh_total",
  "racha_semanas",
  "ahorro_pct_reto",
] as const;
export type BadgeCriteria = (typeof BADGE_CRITERIA)[number];

export const AWARD_TYPES = ["oro", "plata", "bronce"] as const;
export type AwardType = (typeof AWARD_TYPES)[number];

/** Slugs semilla de categorías (la tabla `categories` puede tener más). */
export const DEFAULT_CATEGORY_SLUGS = [
  "iluminacion",
  "refrigeracion",
  "entretenimiento",
  "cocina",
  "climatizacion",
  "otros",
] as const;
export type CategorySlug = string;

export const PERIODS = ["diario", "semanal", "mensual", "anual"] as const;
export type Period = (typeof PERIODS)[number];

// ---------------------------------------------------------------------------
// Tablas (filas tal como las devuelve Supabase)
// ---------------------------------------------------------------------------
export interface AppSettings {
  id: 1;
  co2_kg_per_kwh: number;
  default_tariff_hogar: number;
  default_tariff_negocio: number;
  currency: string;
  timezone: string;
  challenge_grace_days: number;
  points_progress_log: number;
  points_habit_log: number;
  streak_bonus_per_week: number;
  streak_bonus_cap: number;
  updated_at: TimestampString;
}

export interface Level {
  level: number;
  name: string;
  min_points: number;
  description: string | null;
}

export interface Category {
  slug: CategorySlug;
  name: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: TimestampString;
  updated_at: TimestampString;
}

export interface Community {
  id: UUID;
  name: string;
  municipality: string | null;
  state: string | null;
  postal_code: string | null;
  created_by: UUID | null;
  created_at: TimestampString;
}

export interface Profile {
  id: UUID;
  full_name: string;
  account_type: AccountType;
  role: UserRole;
  community_id: UUID | null;
  tariff_per_kwh: number;
  avatar_url: string | null;
  points: number;
  level: number;
  streak_weeks: number;
  last_completed_week: DateString | null;
  created_at: TimestampString;
  updated_at: TimestampString;
}

/** Columnas de `profiles` que el propio usuario puede modificar. */
export type ProfileUpdate = Partial<Pick<Profile, "full_name" | "account_type" | "community_id" | "tariff_per_kwh" | "avatar_url">>;

export interface ApplianceCatalogItem {
  id: UUID;
  name: string;
  category_slug: CategorySlug;
  default_watts: number;
  default_hours_per_day: number;
  default_days_per_week: number;
  description: string | null;
  is_active: boolean;
  created_at: TimestampString;
  updated_at: TimestampString;
}

export interface Appliance {
  id: UUID;
  user_id: UUID;
  catalog_id: UUID | null;
  name: string;
  category_slug: CategorySlug;
  watts: number;
  quantity: number;
  hours_per_day: number;
  days_per_week: number;
  created_at: TimestampString;
  updated_at: TimestampString;
}

/** Datos para crear un aparato (user_id lo pone la BD con auth.uid()). */
export interface ApplianceInsert {
  name: string;
  category_slug: CategorySlug;
  watts: number;
  quantity: number;
  hours_per_day: number;
  days_per_week: number;
  catalog_id?: UUID | null;
}

export type ApplianceUpdate = Partial<ApplianceInsert>;

export interface ConsumptionSnapshot {
  id: UUID;
  user_id: UUID;
  snapshot_date: DateString;
  appliance_count: number;
  daily_kwh: number;
  weekly_kwh: number;
  monthly_kwh: number;
  yearly_kwh: number;
  tariff_per_kwh: number;
  monthly_cost: number;
  monthly_co2_kg: number;
  updated_at: TimestampString;
}

export interface HabitLog {
  id: UUID;
  user_id: UUID;
  log_date: DateString;
  habit_type: HabitType;
  appliance_id: UUID | null;
  item_count: number;
  watts_per_item: number | null;
  hours_per_day: number;
  days_per_week: number;
  notes: string | null;
  created_at: TimestampString;
}

export interface HabitLogInsert {
  habit_type: HabitType;
  log_date?: DateString;
  appliance_id?: UUID | null;
  item_count?: number;
  watts_per_item?: number | null;
  hours_per_day: number;
  days_per_week?: number;
  notes?: string | null;
}

export interface Challenge {
  id: UUID;
  title: string;
  description: string;
  tips: string | null;
  category_slug: CategorySlug | null;
  target_reduction_pct: number;
  points_reward: number;
  week_start: DateString;
  week_end: DateString;
  is_active: boolean;
  created_by: UUID | null;
  created_at: TimestampString;
  updated_at: TimestampString;
}

export interface ChallengeInsert {
  title: string;
  description: string;
  tips?: string | null;
  category_slug?: CategorySlug | null;
  target_reduction_pct?: number;
  points_reward?: number;
  /** Debe ser lunes */
  week_start: DateString;
  is_active?: boolean;
}

export interface ChallengeParticipation {
  id: UUID;
  user_id: UUID;
  challenge_id: UUID;
  status: ParticipationStatus;
  joined_at: TimestampString;
  baseline_weekly_kwh: number;
  final_weekly_kwh: number | null;
  savings_kwh: number | null;
  savings_pct: number | null;
  savings_cost: number | null;
  savings_co2_kg: number | null;
  target_met: boolean | null;
  points_awarded: number;
  completed_at: TimestampString | null;
  verification_source: VerificationSource;
  meter_reading_start_kwh: number | null;
  meter_reading_kwh: number | null;
  notes: string | null;
}

export interface ChallengeProgressLog {
  id: UUID;
  participation_id: UUID;
  user_id: UUID;
  log_date: DateString;
  note: string | null;
  meter_reading_kwh: number | null;
  points_awarded: number;
  created_at: TimestampString;
}

export interface Badge {
  id: UUID;
  code: string;
  name: string;
  description: string;
  icon: string | null;
  criteria_type: BadgeCriteria;
  criteria_value: number;
  points_bonus: number;
  is_active: boolean;
  created_at: TimestampString;
}

export interface UserBadge {
  user_id: UUID;
  badge_id: UUID;
  awarded_at: TimestampString;
}

export interface PointsLedgerEntry {
  id: UUID;
  user_id: UUID;
  points: number;
  reason: PointsReason;
  reference_id: UUID | null;
  description: string | null;
  created_at: TimestampString;
}

export interface CommunityAward {
  id: UUID;
  community_id: UUID;
  period_start: DateString;
  period_end: DateString;
  award: AwardType;
  rank: 1 | 2 | 3;
  participants: number;
  avg_savings_pct: number;
  total_savings_kwh: number;
  created_at: TimestampString;
}

// ---------------------------------------------------------------------------
// Respuestas de funciones RPC
// ---------------------------------------------------------------------------
export interface ConsumptionSummaryRow {
  period: Period;
  kwh: number;
  cost: number;
  co2_kg: number;
}

export interface ConsumptionByCategoryRow {
  category_slug: CategorySlug;
  category_name: string;
  appliance_count: number;
  monthly_kwh: number;
  monthly_cost: number;
  monthly_co2_kg: number;
  pct: number;
}

export interface ConsumptionByApplianceRow {
  appliance_id: UUID;
  name: string;
  category_slug: CategorySlug;
  monthly_kwh: number;
  monthly_cost: number;
  monthly_co2_kg: number;
  pct: number;
}

export interface ActiveChallengeRow {
  id: UUID;
  title: string;
  description: string;
  tips: string | null;
  category_slug: CategorySlug | null;
  target_reduction_pct: number;
  points_reward: number;
  week_start: DateString;
  week_end: DateString;
  can_join: boolean;
  participants_count: number;
  my_participation_id: UUID | null;
  my_status: ParticipationStatus | null;
}

export interface NewBadgeInfo {
  code: string;
  name: string;
  icon: string | null;
}

export interface LogProgressResult {
  log_id: UUID;
  points_awarded: number;
  new_badges: NewBadgeInfo[];
}

export interface CompleteChallengeResult {
  participation_id: UUID;
  baseline_weekly_kwh: number;
  final_weekly_kwh: number;
  savings_kwh: number;
  savings_pct: number;
  savings_cost: number;
  savings_co2_kg: number;
  target_reduction_pct: number;
  target_met: boolean;
  points_awarded: number;
  streak_weeks: number;
  streak_bonus: number;
  total_points: number;
  level: number;
  new_badges: NewBadgeInfo[];
  verification_note: string;
}

export interface GamificationBadge {
  code: string;
  name: string;
  description: string;
  icon: string | null;
  earned: boolean;
  awarded_at: TimestampString | null;
}

export interface MyGamification {
  points: number;
  level: number;
  level_name: string | null;
  current_level_min: number | null;
  next_level_min: number | null;
  streak_weeks: number;
  completed_challenges: number;
  total_savings_kwh: number;
  badges: GamificationBadge[];
}

export interface SavingsHistoryRow {
  week_start: DateString;
  savings_kwh: number;
  savings_cost: number;
  savings_co2_kg: number;
  completed_challenges: number;
}

export type LeaderboardScope = "global" | "comunidad";

export interface LeaderboardRow {
  rank: number;
  user_id: UUID;
  display_name: string;
  community_name: string | null;
  avg_savings_pct: number;
  total_savings_kwh: number;
  completed_challenges: number;
  points: number;
  level: number;
  is_me: boolean;
}

export interface CommunityRankingRow {
  rank: number;
  community_id: UUID;
  community_name: string;
  municipality: string | null;
  participants: number;
  avg_savings_pct: number;
  total_savings_kwh: number;
  total_savings_cost: number;
  total_savings_co2_kg: number;
  gold_awards: number;
  total_awards: number;
}

export interface TopChallengeStat {
  challenge_id: UUID;
  title: string;
  completions: number;
  avg_savings_pct: number;
  total_savings_kwh: number;
}

export interface WeeklySavingsPoint {
  week_start: DateString;
  savings_kwh: number;
  savings_cost: number;
  savings_co2_kg: number;
  participants: number;
}

export interface CommunityStats {
  community_id: UUID | null;
  community_name: string | null;
  currency: string;
  total_members: number;
  active_participants: number;
  challenges_completed: number;
  total_savings_kwh: number;
  total_savings_cost: number;
  total_savings_co2_kg: number;
  avg_savings_pct: number;
  top_challenges: TopChallengeStat[];
  weekly_series: WeeklySavingsPoint[];
  awards: { period_start: DateString; award: AwardType; rank: number }[];
}

export interface AdminUserRow {
  id: UUID;
  email: string;
  full_name: string;
  account_type: AccountType;
  role: UserRole;
  community_name: string | null;
  points: number;
  level: number;
  created_at: TimestampString;
}

/** Nombres y argumentos de todas las RPC (útil para envolver supabase.rpc con tipos). */
export interface RpcFunctions {
  get_my_consumption_summary: { args: Record<string, never>; returns: ConsumptionSummaryRow[] };
  get_my_consumption_by_category: { args: Record<string, never>; returns: ConsumptionByCategoryRow[] };
  get_my_consumption_by_appliance: { args: Record<string, never>; returns: ConsumptionByApplianceRow[] };
  get_active_challenges: { args: Record<string, never>; returns: ActiveChallengeRow[] };
  join_challenge: { args: { p_challenge_id: UUID }; returns: ChallengeParticipation };
  log_challenge_progress: {
    args: { p_participation_id: UUID; p_note?: string | null; p_meter_reading_kwh?: number | null };
    returns: LogProgressResult;
  };
  complete_challenge: {
    args: { p_participation_id: UUID; p_meter_reading_kwh?: number | null; p_notes?: string | null };
    returns: CompleteChallengeResult;
  };
  abandon_challenge: { args: { p_participation_id: UUID }; returns: null };
  get_my_gamification: { args: Record<string, never>; returns: MyGamification };
  get_my_savings_history: { args: { p_weeks?: number }; returns: SavingsHistoryRow[] };
  get_leaderboard: {
    args: { p_scope?: LeaderboardScope; p_days?: number; p_limit?: number };
    returns: LeaderboardRow[];
  };
  get_community_ranking: { args: { p_days?: number; p_limit?: number }; returns: CommunityRankingRow[] };
  get_community_stats: { args: { p_community_id?: UUID | null; p_days?: number }; returns: CommunityStats };
  admin_set_user_role: { args: { p_user_id: UUID; p_role: UserRole }; returns: null };
  admin_list_users: { args: { p_search?: string | null; p_limit?: number }; returns: AdminUserRow[] };
  admin_grant_community_awards: { args: { p_week_start?: DateString | null }; returns: CommunityAward[] };
}

export type RpcName = keyof RpcFunctions;
export type RpcArgs<N extends RpcName> = RpcFunctions[N]["args"];
export type RpcReturns<N extends RpcName> = RpcFunctions[N]["returns"];
