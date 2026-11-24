"use server";

// Registrar y eliminar hábitos. La BD completa watts_per_item por defecto,
// otorga +2 puntos (una vez al día) y revisa insignias mediante triggers.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { validateHabit } from "@/lib/energyCalculations";
import { type FormState, isUuid, readText } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

export async function saveHabit(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: own } = await supabase.from("appliances").select("id").eq("user_id", user.id);

  const result = validateHabit(
    {
      habit_type: readText(formData, "habit_type"),
      log_date: readText(formData, "log_date") || undefined,
      appliance_id: readText(formData, "appliance_id") || null,
      item_count: readText(formData, "item_count"),
      watts_per_item: readText(formData, "watts_per_item"),
      hours_per_day: readText(formData, "hours_per_day"),
      days_per_week: readText(formData, "days_per_week"),
      notes: readText(formData, "notes"),
    },
    (own ?? []).map((a) => a.id as string),
  );

  if (!result.ok) {
    return { status: "error", message: "Revisa los campos marcados.", fieldErrors: result.errors as Record<string, string> };
  }

  const { error } = await supabase.from("habit_logs").insert(result.data);
  if (error) return { status: "error", message: "No pudimos guardar el registro. Intenta de nuevo." };

  revalidatePath("/habitos");
  revalidatePath("/dashboard");
  redirect("/habitos?ok=registrado");
}

export async function deleteHabit(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = readText(formData, "id");
  if (!isUuid(id)) return;

  const supabase = await createClient();
  await supabase.from("habit_logs").delete().eq("id", id).eq("user_id", user.id);

  revalidatePath("/habitos");
  revalidatePath("/dashboard");
  redirect("/habitos?ok=eliminado");
}
