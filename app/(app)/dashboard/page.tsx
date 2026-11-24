import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Award, CircleCheck, Circle, Flame, Star } from "lucide-react";
import { ConsumptionBreakdownCharts } from "@/components/charts/ConsumptionBreakdownCharts";
import { ConsumptionHistoryChart, type HistoryPoint } from "@/components/charts/ConsumptionHistoryChart";
import { WeeklyBarChart } from "@/components/charts/WeeklyBarChart";
import { PageHeader } from "@/components/layout/PageHeader";
import { RecommendationList } from "@/components/recommendations/RecommendationList";
import { Alert } from "@/components/ui/Alert";
import { Card, CardTitle } from "@/components/ui/Card";
import { requireProfile } from "@/lib/auth";
import { getCategories, getCo2Factor, getMyAppliances } from "@/lib/data/appliances";
import { getCommunityStats, getMySavingsHistory, getMySnapshots } from "@/lib/data/dashboard";
import { getMyHabits } from "@/lib/data/habits";
import { addDays, todayIn } from "@/lib/dates";
import { calculateTotals } from "@/lib/energyCalculations";
import { ACCOUNT_TYPE_LABELS, formatCurrency, formatNumber } from "@/lib/format";
import { generateRecommendations, summarizeRecommendations } from "@/lib/recommendations";
import { callRpc } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Panel" };

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const searchParams = await props.searchParams;
  const profile = await requireProfile();
  const supabase = await createClient();

  const today = todayIn();

  const [gamificationRes, participationsRes, appliances, categories, co2Factor, habits, snapshots, savingsHistory, community] =
    await Promise.all([
      callRpc(supabase, "get_my_gamification"),
      supabase.from("challenge_participations").select("id", { count: "exact", head: true }),
      getMyAppliances(profile.id),
      getCategories(),
      getCo2Factor(),
      getMyHabits(profile.id, addDays(today, -30)),
      getMySnapshots(profile.id, addDays(today, -90)),
      getMySavingsHistory(12),
      getCommunityStats(profile.community_id),
    ]);

  const g = gamificationRes.data;
  const applianceCount = appliances.length;
  const totals = calculateTotals(appliances, profile.tariff_per_kwh, co2Factor);
  const recommendations = generateRecommendations({
    appliances,
    habits,
    tariffPerKwh: profile.tariff_per_kwh,
    co2KgPerKwh: co2Factor,
    accountType: profile.account_type,
    today,
    limit: 12,
  });
  const potential = summarizeRecommendations(recommendations);

  // Historial escalonado: se extiende hasta hoy con el último valor conocido
  const history: HistoryPoint[] = snapshots.map((s) => ({
    date: s.snapshot_date,
    monthlyKwh: s.monthly_kwh,
    monthlyCost: s.monthly_cost,
    applianceCount: s.appliance_count,
  }));
  const last = history.at(-1);
  if (last && last.date < today) history.push({ ...last, date: today });

  const savingsTotal = savingsHistory.reduce((sum, w) => sum + w.savings_kwh, 0);
  const participationCount = participationsRes.count ?? 0;

  const points = g?.points ?? profile.points;
  const levelMin = g?.current_level_min ?? 0;
  const nextMin = g?.next_level_min ?? null;
  const progress = nextMin ? Math.min(100, Math.round(((points - levelMin) / (nextMin - levelMin)) * 100)) : 100;
  const earnedBadges = (g?.badges ?? []).filter((b) => b.earned);
  const totalBadges = g?.badges.length ?? 0;

  const steps = [
    {
      done: Boolean(profile.community_id),
      title: "Elige tu comunidad y revisa tu tarifa",
      text: "Así comparas tu ahorro con tus vecinos y los costos salen exactos.",
      href: "/perfil",
    },
    {
      done: applianceCount > 0,
      title: "Registra tus aparatos eléctricos",
      text: "Con ellos calculamos tu consumo diario, mensual y anual.",
      href: "/aparatos",
    },
    {
      done: participationCount > 0,
      title: "Únete a un reto semanal",
      text: "Gana puntos e insignias mientras reduces tu consumo.",
      href: "/retos",
    },
  ];

  const firstName = profile.full_name.split(" ")[0] || "de nuevo";

  return (
    <>
      <PageHeader
        title={`Hola, ${firstName} 👋`}
        description={`${ACCOUNT_TYPE_LABELS[profile.account_type]}${
          profile.community ? ` · ${profile.community.name}` : ""
        }`}
      />

      <div className="space-y-4">
        {searchParams.bienvenida === "1" && (
          <Alert variant="success">¡Tu cuenta está lista! Empieza registrando tus aparatos para conocer tu consumo.</Alert>
        )}
        {searchParams.error === "no-autorizado" && (
          <Alert variant="error">No tienes permisos para entrar al panel de administración.</Alert>
        )}
        {gamificationRes.error && (
          <Alert variant="error">No pudimos cargar tus puntos en este momento. Intenta recargar la página.</Alert>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Star className="size-4 text-amber-500" aria-hidden /> Nivel {g?.level ?? profile.level}
          </div>
          <p className="mt-1 text-xl font-bold text-slate-900">{g?.level_name ?? "Chispa"}</p>
          <p className="mt-1 text-sm text-slate-600">{formatNumber(points, 0)} puntos</p>
          <div
            className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progreso al siguiente nivel"
          >
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            {nextMin ? `${formatNumber(nextMin - points, 0)} puntos para el siguiente nivel` : "¡Nivel máximo alcanzado!"}
          </p>
        </Card>

        <Card>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Flame className="size-4 text-orange-500" aria-hidden /> Constancia
          </div>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {g?.streak_weeks ?? profile.streak_weeks} {(g?.streak_weeks ?? profile.streak_weeks) === 1 ? "semana" : "semanas"}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {g?.completed_challenges ?? 0} retos completados · {formatNumber(g?.total_savings_kwh ?? 0)} kWh ahorrados
          </p>
        </Card>

        <Card className="sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Award className="size-4 text-emerald-600" aria-hidden /> Insignias
          </div>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {earnedBadges.length} <span className="text-base font-medium text-slate-500">de {totalBadges}</span>
          </p>
          {earnedBadges.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {earnedBadges.map((b) => (
                <li
                  key={b.code}
                  title={b.description}
                  className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800"
                >
                  {b.icon} {b.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-slate-600">Registra tu primer aparato para ganar la primera.</p>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>Primeros pasos</CardTitle>
          <ol className="mt-3 divide-y divide-slate-100">
            {steps.map((step) => (
              <li key={step.href}>
                <Link href={step.href} className="group flex items-start gap-3 py-3">
                  {step.done ? (
                    <CircleCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-label="Completado" />
                  ) : (
                    <Circle className="mt-0.5 size-5 shrink-0 text-slate-300" aria-label="Pendiente" />
                  )}
                  <span className="flex-1">
                    <span className={`block font-medium ${step.done ? "text-slate-500 line-through" : "text-slate-900"}`}>
                      {step.title}
                    </span>
                    <span className="block text-sm text-slate-500">{step.text}</span>
                  </span>
                  <ArrowRight className="mt-0.5 size-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" aria-hidden />
                </Link>
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <CardTitle>Mi configuración</CardTitle>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Tipo de perfil</dt>
              <dd className="font-medium text-slate-900">{ACCOUNT_TYPE_LABELS[profile.account_type]}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Comunidad</dt>
              <dd className="text-right font-medium text-slate-900">{profile.community?.name ?? "Sin asignar"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Tarifa</dt>
              <dd className="font-medium text-slate-900">{formatCurrency(profile.tariff_per_kwh)} / kWh</dd>
            </div>
          </dl>
          <Link href="/perfil" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline">
            Editar perfil <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Card>
      </div>

      {/* Consumo */}
      <Card className="mt-4">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <CardTitle>Tu consumo estimado</CardTitle>
          {applianceCount > 0 && (
            <p className="text-sm text-slate-600">
              {formatNumber(totals.kwh.mensual)} kWh · {formatCurrency(totals.cost.mensual)} · {formatNumber(totals.co2Kg.mensual)} kg
              CO₂ al mes
            </p>
          )}
        </div>
        {applianceCount > 0 ? (
          <ConsumptionBreakdownCharts
            appliances={appliances}
            categories={categories}
            tariff={profile.tariff_per_kwh}
            co2Factor={co2Factor}
          />
        ) : (
          <p className="py-6 text-center text-sm text-slate-600">
            <Link href="/aparatos/nuevo" className="font-semibold text-emerald-700 hover:underline">
              Registra tus aparatos
            </Link>{" "}
            para ver tus gráficas de consumo.
          </p>
        )}
      </Card>

      {/* Evolución */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Evolución de tu consumo mensual</CardTitle>
          <p className="mb-3 text-xs text-slate-500">Últimos 90 días · cambia cuando editas tus aparatos o tu tarifa</p>
          <ConsumptionHistoryChart data={history} />
        </Card>
        <Card>
          <CardTitle>Ahorro semanal en retos</CardTitle>
          <p className="mb-3 text-xs text-slate-500">
            Últimas 12 semanas · total {formatNumber(savingsTotal)} kWh
          </p>
          {savingsTotal > 0 ? (
            <WeeklyBarChart
              ariaLabel="kWh ahorrados por semana en retos"
              unitLabel="kWh"
              data={savingsHistory.map((w) => ({
                weekStart: w.week_start,
                value: w.savings_kwh,
                details: [
                  formatCurrency(w.savings_cost),
                  `${formatNumber(w.savings_co2_kg)} kg CO₂ evitados`,
                  `${w.completed_challenges} ${w.completed_challenges === 1 ? "reto completado" : "retos completados"}`,
                ],
              }))}
            />
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">
              Completa tu primer{" "}
              <Link href="/retos" className="font-semibold text-emerald-700 hover:underline">
                reto semanal
              </Link>{" "}
              para ver aquí la evolución de tu ahorro.
            </p>
          )}
        </Card>
      </div>

      {/* Recomendaciones y comunidad */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-baseline justify-between gap-2">
            <CardTitle>Recomendaciones para ti</CardTitle>
            <Link href="/habitos#recomendaciones" className="text-sm font-semibold text-emerald-700 hover:underline">
              Ver todas
            </Link>
          </div>
          {potential.costMonth > 0 && (
            <p className="mt-1 text-sm text-slate-600">
              Podrías ahorrar hasta <strong className="text-slate-900">{formatCurrency(potential.costMonth)} al mes</strong> sin
              invertir.
            </p>
          )}
          <div className="mt-2">
            <RecommendationList
              items={[
                ...recommendations.filter((r) => r.effort !== "inversion"),
                ...recommendations.filter((r) => r.effort === "inversion"),
              ].slice(0, 3)}
              compact
            />
          </div>
        </Card>

        <Card>
          <CardTitle>{community?.community_name ? `Comunidad: ${community.community_name}` : "Toda la plataforma"}</CardTitle>
          {community ? (
            <>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-slate-50 p-2">
                  <dt className="text-xs text-slate-500">Participantes activos</dt>
                  <dd className="text-lg font-bold text-slate-900">{formatNumber(community.active_participants, 0)}</dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-2">
                  <dt className="text-xs text-slate-500">kWh ahorrados</dt>
                  <dd className="text-lg font-bold text-slate-900">{formatNumber(community.total_savings_kwh, 1)}</dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-2">
                  <dt className="text-xs text-slate-500">CO₂ evitado</dt>
                  <dd className="text-lg font-bold text-slate-900">{formatNumber(community.total_savings_co2_kg, 1)} kg</dd>
                </div>
              </dl>
              <div className="mt-4">
                <WeeklyBarChart
                  ariaLabel="kWh ahorrados por semana en la comunidad"
                  unitLabel="kWh"
                  data={community.weekly_series.map((w) => ({
                    weekStart: w.week_start,
                    value: Number(w.savings_kwh),
                    details: [
                      formatCurrency(Number(w.savings_cost)),
                      `${w.participants} ${w.participants === 1 ? "participante" : "participantes"}`,
                    ],
                  }))}
                />
              </div>
              {!profile.community_id && (
                <p className="mt-2 text-xs text-slate-500">
                  <Link href="/perfil" className="font-semibold text-emerald-700 hover:underline">
                    Elige tu comunidad
                  </Link>{" "}
                  para ver solo a tus vecinos.
                </p>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-600">No pudimos cargar las estadísticas de la comunidad.</p>
          )}
        </Card>
      </div>
    </>
  );
}
