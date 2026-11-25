"use server";

// Acciones del panel de administrador.
// Triple protección: proxy.ts (ruta /admin) → requireAdmin() aquí → RLS en Supabase
// (las políticas "admin escribe" solo aceptan usuarios con role = 'admin').
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  validateCatalogItem,
  validateCategory,
  validateChallenge,
} from "@/lib/admin/validation";
import { requireAdmin } from "@/lib/auth";
import { addDays } from "@/lib/dates";
import { type FormState, isUuid, readText } from "@/lib/forms";
import { callRpc } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/server";

function refreshPublic() {
  revalidatePath("/retos");
  revalidatePath("/aparatos");
  revalidatePath("/dashboard");
  revalidatePath("/comunidad");
}

async function categorySlugs() {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("slug");
  return (data ?? []).map((c) => c.slug as string);
}

// ---------------------------------------------------------------------------
// Retos
// ---------------------------------------------------------------------------
export async function saveChallenge(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = readText(formData, "id");
  const values = {
    title: readText(formData, "title"),
    description: readText(formData, "description"),
    tips: readText(formData, "tips"),
    category_slug: readText(formData, "category_slug"),
    target_reduction_pct: readText(formData, "target_reduction_pct"),
    points_reward: readText(formData, "points_reward"),
    week_start: readText(formData, "week_start"),
    is_active: formData.get("is_active") === "on",
  };
  const result = validateChallenge(values, await categorySlugs());
  if (!result.ok) {
    return {
      status: "error",
      message: "Revisa los campos marcados.",
      fieldErrors: result.errors as Record<string, string>,
      values: { ...values, is_active: values.is_active ? "on" : "" },
    };
  }

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("challenges").update(result.data).eq("id", id)
    : await supabase.from("challenges").insert(result.data);
  if (error) return { status: "error", message: `No se pudo guardar el reto: ${error.message}` };

  revalidatePath("/admin/retos");
  refreshPublic();
  redirect(`/admin/retos?ok=${id ? "actualizado" : "creado"}`);
}

export async function toggleChallenge(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = readText(formData, "id");
  const active = readText(formData, "active") === "true";
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase.from("challenges").update({ is_active: !active }).eq("id", id);
  revalidatePath("/admin/retos");
  refreshPublic();
}

/** Copia un reto a la semana siguiente (útil para publicar los retos de cada semana). */
export async function duplicateChallenge(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = readText(formData, "id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  const { data: c } = await supabase.from("challenges").select("*").eq("id", id).maybeSingle();
  if (!c) return;
  await supabase.from("challenges").insert({
    title: c.title,
    description: c.description,
    tips: c.tips,
    category_slug: c.category_slug,
    target_reduction_pct: c.target_reduction_pct,
    points_reward: c.points_reward,
    week_start: addDays(c.week_start as string, 7),
    is_active: true,
  });
  revalidatePath("/admin/retos");
  refreshPublic();
  redirect("/admin/retos?ok=duplicado");
}

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------
export async function saveCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const originalSlug = readText(formData, "original_slug");
  const isNew = !originalSlug;
  const values = {
    slug: isNew ? readText(formData, "slug") : originalSlug,
    name: readText(formData, "name"),
    icon: readText(formData, "icon"),
    sort_order: readText(formData, "sort_order"),
  };
  const result = validateCategory(values, { isNew, existingSlugs: await categorySlugs() });
  if (!result.ok) {
    return { status: "error", message: "Revisa los campos marcados.", fieldErrors: result.errors as Record<string, string>, values };
  }

  const supabase = await createClient();
  const { error } = isNew
    ? await supabase.from("categories").insert(result.data)
    : await supabase
        .from("categories")
        .update({ name: result.data.name, icon: result.data.icon, sort_order: result.data.sort_order })
        .eq("slug", originalSlug);
  if (error) return { status: "error", message: `No se pudo guardar la categoría: ${error.message}`, values };

  revalidatePath("/admin/categorias");
  refreshPublic();
  redirect(`/admin/categorias?ok=${isNew ? "creada" : "actualizada"}`);
}

export async function toggleCategory(formData: FormData): Promise<void> {
  await requireAdmin();
  const slug = readText(formData, "id");
  const active = readText(formData, "active") === "true";
  if (!slug) return;
  const supabase = await createClient();
  await supabase.from("categories").update({ is_active: !active }).eq("slug", slug);
  revalidatePath("/admin/categorias");
  refreshPublic();
}

export async function deleteCategory(formData: FormData): Promise<void> {
  await requireAdmin();
  const slug = readText(formData, "id");
  if (!slug) return;
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("slug", slug);
  revalidatePath("/admin/categorias");
  refreshPublic();
  // 23503 = la categoría está en uso por aparatos o por el catálogo (FK ON DELETE RESTRICT)
  redirect(error ? `/admin/categorias?error=${error.code === "23503" ? "en-uso" : "desconocido"}` : "/admin/categorias?ok=eliminada");
}

// ---------------------------------------------------------------------------
// Catálogo de aparatos
// ---------------------------------------------------------------------------
export async function saveCatalogItem(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = readText(formData, "id");
  const values = {
    name: readText(formData, "name"),
    category_slug: readText(formData, "category_slug"),
    default_watts: readText(formData, "default_watts"),
    default_hours_per_day: readText(formData, "default_hours_per_day"),
    default_days_per_week: readText(formData, "default_days_per_week"),
    description: readText(formData, "description"),
    is_active: formData.get("is_active") === "on",
  };
  const result = validateCatalogItem(values, await categorySlugs());
  if (!result.ok) {
    return {
      status: "error",
      message: "Revisa los campos marcados.",
      fieldErrors: result.errors as Record<string, string>,
      values: { ...values, is_active: values.is_active ? "on" : "" },
    };
  }

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("appliance_catalog").update(result.data).eq("id", id)
    : await supabase.from("appliance_catalog").insert(result.data);
  if (error) {
    const message = error.code === "23505" ? "Ya existe un aparato con ese nombre en el catálogo." : `No se pudo guardar: ${error.message}`;
    return { status: "error", message, values: { ...values, is_active: values.is_active ? "on" : "" } };
  }

  revalidatePath("/admin/catalogo");
  revalidatePath("/aparatos/nuevo");
  redirect(`/admin/catalogo?ok=${id ? "actualizado" : "creado"}`);
}

export async function toggleCatalogItem(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = readText(formData, "id");
  const active = readText(formData, "active") === "true";
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase.from("appliance_catalog").update({ is_active: !active }).eq("id", id);
  revalidatePath("/admin/catalogo");
  revalidatePath("/aparatos/nuevo");
}

export async function deleteCatalogItem(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = readText(formData, "id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  // Los aparatos de usuarios creados desde este elemento conservan sus datos (catalog_id pasa a null)
  await supabase.from("appliance_catalog").delete().eq("id", id);
  revalidatePath("/admin/catalogo");
  revalidatePath("/aparatos/nuevo");
  redirect("/admin/catalogo?ok=eliminado");
}

// ---------------------------------------------------------------------------
// Usuarios y reconocimientos (RPC con verificación de admin dentro de la BD)
// ---------------------------------------------------------------------------
export async function setUserRole(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = readText(formData, "user_id");
  const role = readText(formData, "role");
  if (!isUuid(userId) || (role !== "user" && role !== "admin")) return;
  const supabase = await createClient();
  const { error } = await callRpc(supabase, "admin_set_user_role", { p_user_id: userId, p_role: role });
  revalidatePath("/admin/usuarios");
  redirect(error ? `/admin/usuarios?error=${encodeURIComponent(error.message)}` : "/admin/usuarios?ok=rol");
}

export async function grantCommunityAwards(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const week = readText(formData, "week_start");
  const supabase = await createClient();
  const { data, error } = await callRpc(supabase, "admin_grant_community_awards", { p_week_start: week || null });
  if (error) return { status: "error", message: error.message };
  refreshPublic();
  revalidatePath("/admin");
  const count = data?.length ?? 0;
  return {
    status: "success",
    message:
      count > 0
        ? `Se entregaron ${count} reconocimiento(s) para la semana del ${week}.`
        : "No hubo reconocimientos nuevos: ninguna comunidad completó retos esa semana o ya se habían entregado.",
  };
}
