import Link from "next/link";
import { BarChart3, Calculator, Leaf, Lightbulb, Trophy, Users } from "lucide-react";
import { primaryButtonClassName } from "@/components/ui/styles";
import { Logo } from "@/components/ui/Logo";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency, formatNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

// Next 16 + Cache Components: este segmento lee la sesión (cookies) en cada petición,
// así que se marca como "bloqueante" en lugar de prerenderizarse en el shell estático.
export const instant = false;

interface GlobalStats {
  total_members: number;
  active_participants: number;
  total_savings_kwh: number;
  total_savings_cost: number;
  total_savings_co2_kg: number;
}

const FEATURES = [
  { Icon: Calculator, title: "Calculadora de consumo", text: "Registra tus aparatos y conoce tu gasto diario, mensual y anual." },
  { Icon: Lightbulb, title: "Recomendaciones", text: "Consejos personalizados según tus aparatos y hábitos." },
  { Icon: Trophy, title: "Retos semanales", text: "Gana puntos, insignias y sube de nivel mientras ahorras." },
  { Icon: Users, title: "Comunidad", text: "Compara resultados y consigue reconocimientos para tu colonia." },
  { Icon: BarChart3, title: "Gráficas", text: "Visualiza tu consumo por aparato y la evolución de tu ahorro." },
  { Icon: Leaf, title: "Impacto ambiental", text: "Mide el CO₂ que dejas de emitir con cada cambio." },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  // RPC pública (funciona sin sesión): estadísticas de toda la plataforma
  const { data } = await supabase.rpc("get_community_stats");
  const stats = data as GlobalStats | null;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-emerald-50 via-white to-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-8">
        <Logo hideTextOnMobile />
        <nav className="flex items-center gap-2">
          {user ? (
            <Link href="/dashboard" className={`${primaryButtonClassName} whitespace-nowrap text-sm`}>
              Ir a mi panel
            </Link>
          ) : (
            <>
              <Link href="/login" className="whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white">
                Entrar
              </Link>
              <Link href="/registro" className={`${primaryButtonClassName} whitespace-nowrap text-sm`}>
                Crear cuenta
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-8">
        <section className="py-10 text-center sm:py-16">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
            ODS 7 · Energía asequible y no contaminante
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Ahorra energía en casa o en tu negocio, <span className="text-emerald-600">junto a tu comunidad</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            Descubre cuánto consumen tus aparatos, cuánto pagas por ello y cómo reducirlo con retos semanales.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href={user ? "/dashboard" : "/registro"} className={`${primaryButtonClassName} px-6 py-3`}>
              {user ? "Ir a mi panel" : "Empezar gratis"}
            </Link>
          </div>
        </section>

        {stats && (
          <section aria-label="Impacto de la comunidad" className="grid gap-4 rounded-3xl bg-slate-900 p-6 text-white sm:grid-cols-4 sm:p-8">
            <div>
              <p className="text-3xl font-bold">{formatNumber(stats.total_members, 0)}</p>
              <p className="text-sm text-slate-300">personas registradas</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{formatNumber(stats.total_savings_kwh)} kWh</p>
              <p className="text-sm text-slate-300">ahorrados en retos</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{formatCurrency(stats.total_savings_cost)}</p>
              <p className="text-sm text-slate-300">ahorro estimado</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{formatNumber(stats.total_savings_co2_kg)} kg</p>
              <p className="text-sm text-slate-300">de CO₂ evitados</p>
            </div>
          </section>
        )}

        <section className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <Icon className="size-6 text-emerald-600" aria-hidden />
              <h2 className="mt-3 font-semibold text-slate-900">{title}</h2>
              <p className="mt-1 text-sm text-slate-600">{text}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
