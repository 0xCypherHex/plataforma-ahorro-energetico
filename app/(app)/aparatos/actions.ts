"use server";

// Crear, editar y eliminar aparatos. La validación usa el mismo módulo portable
// que la app móvil (lib/energyCalculations.ts) y la BD repite los límites con CHECK + RLS.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { validateAppliance } from "@/lib/energyCalculations";
import { type FormState, isUuid, readText } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

export async function saveAppliance(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = readText(formData, "id");
  const catalogId = readText(formData, "catalog_id");
  const values = {
    name: readText(formData, "name"),
    category_slug: readText(formData, "category_slug"),
    watts: readText(formData, "watts"),
    quantity: readText(formData, "quantity"),
    hours_per_day: readText(formData, "hours_per_day"),
    days_per_week: readText(formData, "days_per_week"),
    catalog_id: isUuid(catalogId) ? catalogId : null,
  };

  const supabase = await createClient();
  const { data: categories } = await supabase.from("categories").select("slug");
  const result = validateAppliance(
    values,
    (categories ?? []).map((c) => c.slug as string),
  );

  if (!result.ok) {
    return { status: "error", message: "Revisa los campos marcados.", fieldErrors: result.errors as Record<string, string> };
  }

  if (id) {
    if (!isUuid(id)) return { status: "error", message: "Aparato no válido." };
    const { data, error } = await supabase
      .from("appliances")
      .update(result.data)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) return { status: "error", message: "No pudimos guardar los cambios. Intenta de nuevo." };
    if (!data) return { status: "error", message: "No encontramos ese aparato en tu cuenta." };
  } else {
    const { error } = await supabase.from("appliances").insert(result.data);
    if (error) return { status: "error", message: "No pudimos registrar el aparato. Intenta de nuevo." };
  }

  revalidatePath("/aparatos");
  revalidatePath("/dashboard");
  redirect(`/aparatos?ok=${id ? "actualizado" : "creado"}`);
}

export async function deleteAppliance(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = readText(formData, "id");
  if (!isUuid(id)) return;

  const supabase = await createClient();
  await supabase.from("appliances").delete().eq("id", id).eq("user_id", user.id);

  revalidatePath("/aparatos");
  revalidatePath("/dashboard");
  redirect("/aparatos?ok=eliminado");
}
