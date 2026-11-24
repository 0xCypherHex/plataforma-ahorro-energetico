import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, CircleX } from "lucide-react";
import { ChallengeCard } from "@/components/challenges/ChallengeCard";
import { VerificationNotice } from "@/components/challenges/VerificationNotice";
import { Achievements } from "@/components/gamification/Achievements";
import { GamificationSummary } from "@/components/gamification/GamificationSummary";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Card, CardTitle } from "@/components/ui/Card";
import { requireProfile } from "@/lib/auth";
import { getCategories, getCo2Factor, getMyAppliances } from "@/lib/data/appliances";
import {
  getActiveChallenges,
  getLevels,
  getMyGamification,
  getMyParticipations,
  getMyPointsHistory,
} from "@/lib/data/challenges";
import { formatDate } from "@/lib/dates";
import { totalWeeklyKwh } from "@/lib/energyCalculations";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

export const metadata: Metadata = { title: "Retos semanales" };

export default async function ChallengesPage() {
  const profile = await requireProfile();

  const [challenges, participations, appliances, categories, co2Factor, gamification, levels, history] = await Promise.all([
    getActiveChallenges(),
    getMyParticipations(profile.id),
    getMyAppliances(profile.id),
    getCategories(),
    getCo2Factor(),
    getMyGamification(),
    getLevels(),
    getMyPointsHistory(profile.id),
  ]);

  // Cada reto mide solo su categoría (o todo el hogar si no tiene): igual que join/complete_challenge en la BD
  const weeklyFor = (slug: string | null) =>
    totalWeeklyKwh(slug ? appliances.filter((a) => a.category_slug === slug) : appliances);
  const countFor = (slug: string | null) =>
    slug ? appliances.filter((a) => a.category_slug === slug).length : appliances.length;
  const measuredLabelFor = (slug: string | null) => {
    if (!slug) return "todo tu hogar";
    const cat = categories.find((x) => x.slug === slug);
    return `tus aparatos de ${cat?.name ?? slug}`;
  };
  const byChallenge = new Map(participations.map((p) => [p.challenge_id, p]));
  const categoryLabel = (slug: string | null) => {
    const c = categories.find((x) => x.slug === slug);
    return c ? `${c.icon ?? ""} ${c.name}`.trim() : null;
  };
  const finished = participations.filter((p) => p.status === "completado");
  const activeCount = participations.filter((p) => p.status === "activo").length;

  return (
    <>
      <PageHeader
        title="Retos semanales"
        description="Únete a uno o varios retos a la vez, cambia tus hábitos y compara tu consumo antes y después."
      />

      <div className="space-y-4">
        {gamification && <GamificationSummary g={gamification} />}
        <VerificationNotice />
        {appliances.length === 0 && (
          <Alert variant="info">
            Para participar necesitas tus aparatos registrados: con ellos medimos tu consumo antes y después.{" "}
            <Link href="/aparatos/nuevo" className="font-semibold underline">
              Registrar aparatos
            </Link>
          </Alert>
        )}
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold text-slate-900">Retos de esta semana</h2>
          {activeCount > 0 && (
            <p className="text-sm text-slate-600">
              Participas en {activeCount} {activeCount === 1 ? "reto" : "retos"}
            </p>
          )}
        </div>
        {challenges.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-600">No hay retos publicados esta semana. Vuelve pronto.</p>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {challenges.map((c) => {
              const participation = byChallenge.get(c.id) ?? null;
              // Si ya participa, se usa la categoría congelada al unirse
              const measured =
                participation && participation.status !== "abandonado" ? participation.measured_category_slug : c.category_slug;
              return (
                <ChallengeCard
                  key={c.id}
                  challenge={c}
                  participation={participation}
                  categoryLabel={categoryLabel(c.category_slug)}
                  currentWeeklyKwh={weeklyFor(measured)}
                  measuredLabel={measuredLabelFor(measured)}
                  tariff={profile.tariff_per_kwh}
                  co2Factor={co2Factor}
                  canMeasure={countFor(measured) > 0}
                />
              );
            })}
          </div>
        )}
      </section>

      <Card className="mt-8">
        <CardTitle>Historial de retos completados</CardTitle>
        {finished.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Cuando completes un reto, aparecerá aquí con su resultado.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="py-2 pr-3 font-medium">Reto</th>
                  <th className="py-2 pr-3 font-medium">Semana</th>
                  <th className="py-2 pr-3 text-right font-medium">Ahorro</th>
                  <th className="py-2 pr-3 text-right font-medium">kWh</th>
                  <th className="py-2 pr-3 text-right font-medium">Dinero</th>
                  <th className="py-2 pr-3 text-right font-medium">CO₂</th>
                  <th className="py-2 pr-3 font-medium">Meta</th>
                  <th className="py-2 text-right font-medium">Puntos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {finished.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-3 font-medium text-slate-900">{p.challenge?.title ?? "Reto desactivado"}</td>
                    <td className="py-2 pr-3 text-slate-600">
                      {p.challenge ? formatDate(p.challenge.week_start, { day: "numeric", month: "short" }) : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right">{formatPercent(p.savings_pct)}</td>
                    <td className="py-2 pr-3 text-right">{formatNumber(Math.max(p.savings_kwh ?? 0, 0))}</td>
                    <td className="py-2 pr-3 text-right">{formatCurrency(p.savings_cost)}</td>
                    <td className="py-2 pr-3 text-right">{formatNumber(p.savings_co2_kg)} kg</td>
                    <td className="py-2 pr-3">
                      {p.target_met ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CircleCheck className="size-4" aria-hidden /> Cumplida
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <CircleX className="size-4" aria-hidden /> No cumplida
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right font-semibold text-emerald-700">+{p.points_awarded}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {gamification && (
        <section className="mt-8">
          <h2 className="mb-3 text-xl font-bold text-slate-900">Mis logros</h2>
          <Achievements
            badges={gamification.badges}
            levels={levels}
            currentLevel={gamification.level}
            points={gamification.points}
            history={history}
          />
        </section>
      )}
    </>
  );
}
