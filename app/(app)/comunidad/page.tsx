import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Coins, Leaf, Medal, Percent, Trophy, Users, Zap } from "lucide-react";
import { WeeklyBarChart } from "@/components/charts/WeeklyBarChart";
import { CommunityRankingTable, LeaderboardTable } from "@/components/community/Rankings";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Card, CardTitle } from "@/components/ui/Card";
import { requireProfile } from "@/lib/auth";
import { getCommunityRanking, getLeaderboard } from "@/lib/data/community";
import { getCommunityStats } from "@/lib/data/dashboard";
import { formatDate } from "@/lib/dates";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import type { AwardType, LeaderboardScope } from "@/types/database";

export const metadata: Metadata = { title: "Comunidad" };

const DAYS = 30;
const AWARD_LABELS: Record<AwardType, string> = { oro: "🥇 Oro", plata: "🥈 Plata", bronce: "🥉 Bronce" };

function ScopeTabs({ scope, hasCommunity }: { scope: LeaderboardScope; hasCommunity: boolean }) {
  const tabs: { key: LeaderboardScope; label: string; disabled: boolean }[] = [
    { key: "comunidad", label: "Mi comunidad", disabled: !hasCommunity },
    { key: "global", label: "Toda la plataforma", disabled: false },
  ];
  return (
    <nav aria-label="Ámbito" className="grid w-full grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:w-80">
      {tabs.map((t) =>
        t.disabled ? (
          <span key={t.key} className="rounded-lg px-3 py-2 text-center text-sm font-medium text-slate-400" title="Elige una comunidad en tu perfil">
            {t.label}
          </span>
        ) : (
          <Link
            key={t.key}
            href={`/comunidad?ambito=${t.key}`}
            aria-current={scope === t.key ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-center text-sm font-medium transition ${
              scope === t.key ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t.label}
          </Link>
        ),
      )}
    </nav>
  );
}

export default async function CommunityPage(props: PageProps<"/comunidad">) {
  const searchParams = await props.searchParams;
  const profile = await requireProfile();
  const hasCommunity = Boolean(profile.community_id);
  const scope: LeaderboardScope = searchParams.ambito === "global" || !hasCommunity ? "global" : "comunidad";

  const [stats, leaderboard, communityRanking] = await Promise.all([
    getCommunityStats(scope === "comunidad" ? profile.community_id : null),
    getLeaderboard(scope, DAYS, 20),
    getCommunityRanking(DAYS, 20),
  ]);

  const title = scope === "comunidad" ? (profile.community?.name ?? "Mi comunidad") : "Toda la plataforma";

  const cards = stats
    ? [
        { label: "Energía ahorrada", value: `${formatNumber(stats.total_savings_kwh)} kWh`, Icon: Zap, color: "text-amber-500" },
        { label: "Dinero ahorrado", value: formatCurrency(stats.total_savings_cost), Icon: Coins, color: "text-emerald-600" },
        { label: "CO₂ evitado", value: `${formatNumber(stats.total_savings_co2_kg)} kg`, Icon: Leaf, color: "text-green-600" },
        {
          label: "Participantes activos",
          value: `${formatNumber(stats.active_participants, 0)} de ${formatNumber(stats.total_members, 0)}`,
          Icon: Users,
          color: "text-sky-600",
        },
        { label: "Retos completados", value: formatNumber(stats.challenges_completed, 0), Icon: Trophy, color: "text-emerald-600" },
        { label: "Ahorro promedio por reto", value: formatPercent(stats.avg_savings_pct), Icon: Percent, color: "text-slate-600" },
      ]
    : [];

  return (
    <>
      <PageHeader
        title="Comunidad"
        description="Compara resultados, sube en la clasificación y consigue reconocimientos para tu colonia."
        actions={<ScopeTabs scope={scope} hasCommunity={hasCommunity} />}
      />

      {!hasCommunity && (
        <div className="mb-4">
          <Alert variant="info">
            Aún no perteneces a una comunidad.{" "}
            <Link href="/perfil" className="font-semibold underline">
              Elige tu colonia
            </Link>{" "}
            para competir junto a tus vecinos.
          </Alert>
        </div>
      )}

      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900">
        <Building2 className="size-5 text-emerald-600" aria-hidden /> {title}
      </h2>

      {!stats ? (
        <Alert variant="error">No pudimos cargar las estadísticas. Intenta recargar la página.</Alert>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map(({ label, value, Icon, color }) => (
              <Card key={label}>
                <p className="flex items-center gap-2 text-sm font-medium text-slate-500">
                  <Icon className={`size-4 ${color}`} aria-hidden /> {label}
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
              </Card>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Ahorro estimado acumulado de retos completados. Participantes activos: con actividad en los últimos {DAYS} días.
          </p>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardTitle>Ahorro colectivo por semana</CardTitle>
              <p className="mb-3 text-xs text-slate-500">Últimas 8 semanas · kWh ahorrados en retos</p>
              <WeeklyBarChart
                ariaLabel="kWh ahorrados por semana"
                unitLabel="kWh"
                data={stats.weekly_series.map((w) => ({
                  weekStart: w.week_start,
                  value: Number(w.savings_kwh),
                  details: [
                    formatCurrency(Number(w.savings_cost)),
                    `${formatNumber(Number(w.savings_co2_kg))} kg CO₂`,
                    `${w.participants} ${w.participants === 1 ? "participante" : "participantes"}`,
                  ],
                }))}
              />
            </Card>

            <Card>
              <CardTitle>Retos con mejores resultados</CardTitle>
              {stats.top_challenges.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">Aún no hay retos completados.</p>
              ) : (
                <ol className="mt-3 space-y-3">
                  {stats.top_challenges.map((t, i) => (
                    <li key={t.challenge_id} className="flex gap-3">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                        {i + 1}
                      </span>
                      <div className="min-w-0 text-sm">
                        <p className="font-medium text-slate-900">{t.title}</p>
                        <p className="text-slate-500">
                          {formatNumber(Number(t.total_savings_kwh))} kWh · {formatPercent(Number(t.avg_savings_pct))} prom. ·{" "}
                          {t.completions} {Number(t.completions) === 1 ? "vez" : "veces"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>

          {scope === "comunidad" && stats.awards.length > 0 && (
            <Card className="mt-4">
              <CardTitle>Reconocimientos de {title}</CardTitle>
              <ul className="mt-3 flex flex-wrap gap-2">
                {stats.awards.map((a) => (
                  <li key={a.period_start} className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-900">
                    {AWARD_LABELS[a.award]} · semana del {formatDate(a.period_start, { day: "numeric", month: "short" })}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      <div className="mt-8 space-y-4">
        <Card>
          <CardTitle>Clasificación individual · {scope === "comunidad" ? "mi comunidad" : "global"}</CardTitle>
          <p className="mb-3 text-xs text-slate-500">
            Según el porcentaje de ahorro estimado promedio en retos completados (últimos {DAYS} días).
          </p>
          <LeaderboardTable rows={leaderboard} />
        </Card>
        <Card>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <Medal className="size-5 text-amber-500" aria-hidden /> Clasificación de comunidades
            </span>
          </CardTitle>
          <p className="mb-3 text-xs text-slate-500">
            Ahorro colectivo promedio (últimos {DAYS} días). Cada semana el administrador entrega oro, plata y bronce a las
            mejores comunidades.
          </p>
          <CommunityRankingTable rows={communityRanking} myCommunityId={profile.community_id} />
        </Card>
      </div>
    </>
  );
}
