// Capa de acceso a la sesión (solo servidor).
// Úsala en layouts, páginas y Server Actions para obtener el usuario y su perfil.
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AccountType, Community, UserRole } from "@/types/database";

export type { AccountType, UserRole };
export type CommunitySummary = Pick<Community, "id" | "name" | "municipality">;

export interface CurrentProfile {
  id: string;
  email: string;
  full_name: string;
  account_type: AccountType;
  role: UserRole;
  community_id: string | null;
  community: CommunitySummary | null;
  tariff_per_kwh: number;
  avatar_url: string | null;
  points: number;
  level: number;
  streak_weeks: number;
  created_at: string;
}

/** Usuario autenticado (validado contra Supabase Auth) o null. */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
});

/** Perfil del usuario actual con su comunidad, o null si no hay sesión. */
export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, account_type, role, community_id, tariff_per_kwh, avatar_url, points, level, streak_weeks, created_at, community:communities(id, name, municipality)",
    )
    .eq("id", user.id)
    .single();

  if (error || !data) {
    throw new Error(
      "Tu sesión es válida pero no encontramos tu perfil. Verifica que el trigger on_auth_user_created exista en Supabase.",
    );
  }

  const community = Array.isArray(data.community) ? (data.community[0] ?? null) : (data.community ?? null);

  return {
    ...(data as Omit<CurrentProfile, "email" | "community" | "tariff_per_kwh">),
    tariff_per_kwh: Number(data.tariff_per_kwh),
    community: community as CommunitySummary | null,
    email: user.email ?? "",
  };
});

/** Exige sesión. Si no hay, manda a /login. */
export async function requireProfile(): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

/** Exige rol admin. Si no lo es, manda al panel con aviso. */
export async function requireAdmin(): Promise<CurrentProfile> {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/dashboard?error=no-autorizado");
  return profile;
}
