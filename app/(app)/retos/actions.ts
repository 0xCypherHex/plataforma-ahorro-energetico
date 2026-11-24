"use server";

// Server Actions de retos: son envolturas delgadas de las RPC de Supabase.
// La verificación antes/después, los puntos, la racha y las insignias se calculan
// en la base de datos (join_challenge, log_challenge_progress, complete_challenge),
// exactamente igual que cuando las llama la app móvil.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { type FormState, isUuid, readText } from "@/lib/forms";
import { callRpc } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/server";
import type { CompleteChallengeResult, LogProgressResult } from "@/types/database";

export interface ChallengeActionState extends FormState {
  /** Momento de la respuesta: la tarjeta muestra el mensaje más reciente. */
  at?: number;
  progress?: LogProgressResult;
  result?: CompleteChallengeResult;
}

/** Los errores de negocio de las RPC (P0001) ya vienen en español y listos para mostrarse. */
function rpcErrorMessage(error: PostgrestError | null) {
  if (!error) return "Ocurrió un error inesperado.";
  if (["P0001", "28000", "42501"].includes(error.code)) return error.message;
  return "Ocurrió un error inesperado. Intenta de nuevo.";
}

function readMeter(formData: FormData) {
  const raw = readText(formData, "meter_reading_kwh").replace(",", ".");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : Number.NaN;
}

function refresh() {
  revalidatePath("/retos");
  revalidatePath("/dashboard");
  revalidatePath("/comunidad");
}

export async function joinChallenge(_prev: ChallengeActionState, formData: FormData): Promise<ChallengeActionState> {
  if (!(await getCurrentUser())) redirect("/login");
  const challengeId = readText(formData, "challenge_id");
  if (!isUuid(challengeId)) return { at: Date.now(), status: "error", message: "Reto no válido." };

  const supabase = await createClient();
  const { error } = await callRpc(supabase, "join_challenge", { p_challenge_id: challengeId });
  if (error) return { at: Date.now(), status: "error", message: rpcErrorMessage(error) };

  refresh();
  return { at: Date.now(), status: "success", message: "¡Te uniste al reto! Guardamos tu consumo actual como punto de partida." };
}

export async function logProgress(_prev: ChallengeActionState, formData: FormData): Promise<ChallengeActionState> {
  if (!(await getCurrentUser())) redirect("/login");
  const participationId = readText(formData, "participation_id");
  const note = readText(formData, "note");
  const meter = readMeter(formData);
  if (!isUuid(participationId)) return { at: Date.now(), status: "error", message: "Participación no válida." };
  if (Number.isNaN(meter)) return { at: Date.now(), status: "error", message: "La lectura del medidor debe ser un número positivo." };
  if (note.length > 1000) return { at: Date.now(), status: "error", message: "La nota admite máximo 1000 caracteres." };

  const supabase = await createClient();
  const { data, error } = await callRpc(supabase, "log_challenge_progress", {
    p_participation_id: participationId,
    p_note: note || null,
    p_meter_reading_kwh: meter,
  });
  if (error || !data) return { at: Date.now(), status: "error", message: rpcErrorMessage(error) };

  refresh();
  return {
    at: Date.now(),
    status: "success",
    message:
      data.points_awarded > 0
        ? `Avance registrado: +${data.points_awarded} puntos.`
        : "Avance registrado. Hoy ya habías sumado puntos por este reto.",
    progress: data,
  };
}

export async function completeChallenge(_prev: ChallengeActionState, formData: FormData): Promise<ChallengeActionState> {
  if (!(await getCurrentUser())) redirect("/login");
  const participationId = readText(formData, "participation_id");
  const meter = readMeter(formData);
  if (!isUuid(participationId)) return { at: Date.now(), status: "error", message: "Participación no válida." };
  if (Number.isNaN(meter)) return { at: Date.now(), status: "error", message: "La lectura del medidor debe ser un número positivo." };

  const supabase = await createClient();
  const { data, error } = await callRpc(supabase, "complete_challenge", {
    p_participation_id: participationId,
    p_meter_reading_kwh: meter,
    p_notes: readText(formData, "notes") || null,
  });
  if (error || !data) return { at: Date.now(), status: "error", message: rpcErrorMessage(error) };

  refresh();
  return { at: Date.now(), status: "success", result: data };
}

export async function abandonChallenge(_prev: ChallengeActionState, formData: FormData): Promise<ChallengeActionState> {
  if (!(await getCurrentUser())) redirect("/login");
  const participationId = readText(formData, "participation_id");
  if (!isUuid(participationId)) return { at: Date.now(), status: "error", message: "Participación no válida." };

  const supabase = await createClient();
  const { error } = await callRpc(supabase, "abandon_challenge", { p_participation_id: participationId });
  if (error) return { at: Date.now(), status: "error", message: rpcErrorMessage(error) };

  refresh();
  return { at: Date.now(), status: "success", message: "Abandonaste el reto. Puedes volver a unirte mientras siga abierto." };
}
