"use server";

// Actualiza solo las columnas que RLS + GRANT permiten al usuario
// (full_name, account_type, community_id, tariff_per_kwh). Puntos, nivel y rol
// nunca se tocan desde aquí: la base de datos lo impide aunque se intentara.
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { type FormState, NEW_COMMUNITY_VALUE, isUuid, readText } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Tu sesión expiró. Vuelve a iniciar sesión." };

  const fullName = readText(formData, "full_name");
  const accountType = readText(formData, "account_type");
  const communityChoice = readText(formData, "community_choice");
  const newCommunityName = readText(formData, "new_community_name");
  const newCommunityMunicipality = readText(formData, "new_community_municipality");
  const tariffRaw = readText(formData, "tariff_per_kwh").replace(",", ".");
  const tariff = Number(tariffRaw);

  const values = {
    full_name: fullName,
    account_type: accountType,
    community_choice: communityChoice,
    new_community_name: newCommunityName,
    new_community_municipality: newCommunityMunicipality,
    tariff_per_kwh: tariffRaw,
  };

  const fieldErrors: Record<string, string> = {};
  if (fullName.length < 2 || fullName.length > 120) fieldErrors.full_name = "Escribe tu nombre (2 a 120 caracteres).";
  if (accountType !== "hogar" && accountType !== "negocio") fieldErrors.account_type = "Elige el tipo de perfil.";
  if (!tariffRaw || !Number.isFinite(tariff) || tariff <= 0 || tariff > 100)
    fieldErrors.tariff_per_kwh = "Escribe un costo mayor a 0 y menor o igual a 100.";
  if (communityChoice && communityChoice !== NEW_COMMUNITY_VALUE && !isUuid(communityChoice))
    fieldErrors.community_choice = "Elige una comunidad de la lista.";
  if (communityChoice === NEW_COMMUNITY_VALUE && (newCommunityName.length < 2 || newCommunityName.length > 120))
    fieldErrors.new_community_name = "Escribe el nombre de tu colonia o comunidad.";

  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", message: "Revisa los campos marcados.", fieldErrors, values };
  }

  const supabase = await createClient();
  let communityId: string | null = isUuid(communityChoice) ? communityChoice : null;

  if (communityChoice === NEW_COMMUNITY_VALUE) {
    const municipality = newCommunityMunicipality || null;
    const { data: created, error: createError } = await supabase
      .from("communities")
      .insert({ name: newCommunityName, municipality })
      .select("id")
      .single();

    if (created) {
      communityId = created.id;
    } else if (createError?.code === "23505") {
      // Ya existe: la buscamos y la reutilizamos
      const { data: matches } = await supabase
        .from("communities")
        .select("id, municipality")
        .ilike("name", escapeLike(newCommunityName));
      const match = (matches ?? []).find(
        (c) => (c.municipality ?? "").toLowerCase() === (municipality ?? "").toLowerCase(),
      );
      communityId = match?.id ?? null;
    } else {
      return { status: "error", message: "No pudimos registrar la comunidad. Intenta de nuevo.", values };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      account_type: accountType,
      community_id: communityId,
      tariff_per_kwh: Math.round(tariff * 10000) / 10000,
    })
    .eq("id", user.id);

  if (error) {
    return { status: "error", message: "No pudimos guardar los cambios. Intenta de nuevo.", values };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: "Perfil actualizado." };
}
