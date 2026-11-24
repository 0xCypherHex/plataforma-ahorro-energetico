// Lee y valida las variables públicas de Supabase.
// Si falta alguna, el error explica exactamente qué revisar en .env.local.

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Faltan variables de entorno de Supabase. Revisa que .env.local tenga " +
        "NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY y reinicia `npm run dev`.",
    );
  }

  return { url, key };
}
