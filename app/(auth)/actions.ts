"use server";

// Server Actions de autenticación. Solo llaman a Supabase Auth:
// el perfil y la comunidad los crea el trigger handle_new_user en la base de datos,
// exactamente igual que cuando se registra alguien desde la app móvil.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  type FormState,
  NEW_COMMUNITY_VALUE,
  isEmail,
  isUuid,
  readText,
  safeRedirectPath,
  translateAuthError,
} from "@/lib/forms";

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = readText(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeRedirectPath(readText(formData, "next"));

  const fieldErrors: Record<string, string> = {};
  if (!isEmail(email)) fieldErrors.email = "Escribe un correo válido.";
  if (!password) fieldErrors.password = "Escribe tu contraseña.";
  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", fieldErrors, values: { email } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("[login] Supabase Auth error:", error.name, error.status, error.code, error.message);
    return { status: "error", message: translateAuthError(error), values: { email } };
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const fullName = readText(formData, "full_name");
  const email = readText(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("password_confirm") ?? "");
  const accountType = readText(formData, "account_type");
  const communityChoice = readText(formData, "community_choice");
  const newCommunityName = readText(formData, "new_community_name");
  const newCommunityMunicipality = readText(formData, "new_community_municipality");

  const values = {
    full_name: fullName,
    email,
    account_type: accountType,
    community_choice: communityChoice,
    new_community_name: newCommunityName,
    new_community_municipality: newCommunityMunicipality,
  };

  const fieldErrors: Record<string, string> = {};
  if (fullName.length < 2 || fullName.length > 120) fieldErrors.full_name = "Escribe tu nombre (2 a 120 caracteres).";
  if (!isEmail(email)) fieldErrors.email = "Escribe un correo válido.";
  if (password.length < 8) fieldErrors.password = "Usa al menos 8 caracteres.";
  else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password))
    fieldErrors.password = "Combina letras y números.";
  if (password !== passwordConfirm) fieldErrors.password_confirm = "Las contraseñas no coinciden.";
  if (accountType !== "hogar" && accountType !== "negocio") fieldErrors.account_type = "Elige el tipo de perfil.";
  if (communityChoice && communityChoice !== NEW_COMMUNITY_VALUE && !isUuid(communityChoice))
    fieldErrors.community_choice = "Elige una comunidad de la lista.";
  if (communityChoice === NEW_COMMUNITY_VALUE && (newCommunityName.length < 2 || newCommunityName.length > 120))
    fieldErrors.new_community_name = "Escribe el nombre de tu colonia o comunidad.";

  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", message: "Revisa los campos marcados.", fieldErrors, values };
  }

  // Mismo contrato que usa la app móvil (docs/INTEGRACION_MOVIL.md, sección 2.1)
  const metadata: Record<string, string> = { full_name: fullName, account_type: accountType };
  if (isUuid(communityChoice)) {
    metadata.community_id = communityChoice;
  } else if (communityChoice === NEW_COMMUNITY_VALUE) {
    metadata.new_community_name = newCommunityName;
    if (newCommunityMunicipality) metadata.new_community_municipality = newCommunityMunicipality;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });

  if (error) {
    console.error("[signup] Supabase Auth error:", error.name, error.status, error.code, error.message);
    return { status: "error", message: translateAuthError(error), values };
  }

  // Si la confirmación de correo está activada, Supabase no devuelve sesión todavía
  if (!data.session) {
    return {
      status: "success",
      message: "Cuenta creada. Revisa tu correo para confirmarla y después inicia sesión.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard?bienvenida=1");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}