import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/RegisterForm";
import type { CommunitySummary } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function RegisterPage() {
  // La tabla communities es legible sin sesión (política RLS "lectura pública")
  const supabase = await createClient();
  const { data } = await supabase.from("communities").select("id, name, municipality").order("name");
  const communities: CommunitySummary[] = data ?? [];

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-emerald-900/5 sm:p-8">
      <h1 className="text-2xl font-bold text-slate-900">Crea tu cuenta</h1>
      <p className="mt-1 text-slate-600">Calcula tu consumo, recibe recomendaciones y ahorra junto a tu comunidad.</p>

      <div className="mt-6">
        <RegisterForm communities={communities} />
      </div>

      <p className="mt-6 text-center text-sm text-slate-600">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-semibold text-emerald-700 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
