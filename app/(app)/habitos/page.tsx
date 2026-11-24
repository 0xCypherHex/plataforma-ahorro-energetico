import type { Metadata } from "next";
import Link from "next/link";
import { Info, Lightbulb, PlugZap, Sparkles, Timer } from "lucide-react";
import { deleteHabit } from "@/app/(app)/habitos/actions";
import { HabitForm } from "@/components/habits/HabitForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { RecommendationList } from "@/components/recommendations/RecommendationList";
import { Alert } from "@/components/ui/Alert";
import { Card, CardTitle } from "@/components/ui/Card";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { requireProfile } from "@/lib/auth";
import { getCo2Factor, getMyAppliances } from "@/lib/data/appliances";
import { getMyHabits } from "@/lib/data/habits";
import { addDays, formatDate, todayIn } from "@/lib/dates";
import { HABIT_LABELS, WEEKS_PER_MONTH, habitWeeklyKwh } from "@/lib/energyCalculations";
import { formatCurrency, formatNumber } from "@/lib/format";
import { generateRecommendations, summarizeRecommendations } from "@/lib/recommendations";
import type { HabitLog, HabitType } from "@/types/database";

export const metadata: Metadata = { title: "Hábitos y recomendaciones" };

const OK_MESSAGES: Record<string, string> = {
  registrado: "Hábito registrado. Si es tu primer registro del día, ganaste +2 puntos.",
  eliminado: "Registro eliminado.",
};

const TYPE_ICONS: Record<HabitType, typeof Lightbulb> = {
  luces_sin_necesidad: Lightbulb,
  dispositivos_standby: PlugZap,
  uso_aparato: Timer,
};

function averageMonthlyWaste(habits: HabitLog[], type: HabitType) {
  const logs = habits.filter((h) => h.habit_type === type);
  if (logs.length === 0) return 0;
  return (logs.reduce((s, h) => s + habitWeeklyKwh(h), 0) / logs.length) * WEEKS_PER_MONTH;
}

export default async function HabitsPage(props: PageProps<"/habitos">) {
  const searchParams = await props.searchParams;
  const profile = await requireProfile();
  const today = todayIn();

  const [appliances, habits, co2Factor] = await Promise.all([
    getMyAppliances(profile.id),
    getMyHabits(profile.id, addDays(today, -60)),
    getCo2Factor(),
  ]);

  const last30 = habits.filter((h) => h.log_date >= addDays(today, -30));
  const wasteKwh =
    averageMonthlyWaste(last30, "luces_sin_necesidad") + averageMonthlyWaste(last30, "dispositivos_standby");

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
  const applianceById = new Map(appliances.map((a) => [a.id, a]));
  const ok = typeof searchParams.ok === "string" ? OK_MESSAGES[searchParams.ok] : undefined;

  return (
    <>
      <PageHeader
        title="Hábitos y recomendaciones"
        description="Registra tus hábitos diarios y descubre dónde puedes ahorrar."
      />

      {ok && (
        <div className="mb-4">
          <Alert variant="success">{ok}</Alert>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>Nuevo registro</CardTitle>
          <div className="mt-4">
            <HabitForm
              appliances={appliances.map(({ id, name, watts }) => ({ id, name, watts }))}
              today={today}
              tariff={profile.tariff_per_kwh}
              co2Factor={co2Factor}
            />
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardTitle>Desperdicio por hábitos</CardTitle>
            <p className="mt-1 text-xs text-slate-500">Promedio de tus registros de los últimos 30 días</p>
            {wasteKwh > 0 ? (
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Energía al mes</dt>
                  <dd className="font-semibold text-slate-900">{formatNumber(wasteKwh)} kWh</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Dinero al mes</dt>
                  <dd className="font-semibold text-slate-900">{formatCurrency(wasteKwh * profile.tariff_per_kwh)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">CO₂ al mes</dt>
                  <dd className="font-semibold text-slate-900">{formatNumber(wasteKwh * co2Factor)} kg</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-sm text-slate-600">Registra luces encendidas o aparatos en espera para medir tu desperdicio.</p>
            )}
          </Card>
          <Card>
            <div className="flex gap-2 text-sm text-slate-600">
              <Info className="mt-0.5 size-4 shrink-0 text-sky-600" aria-hidden />
              <p>
                Cada día que registras al menos un hábito ganas <strong>+2 puntos</strong>. Con 15 registros obtienes la
                insignia <strong>Hábitos bajo control</strong>.
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Recomendaciones */}
      <section id="recomendaciones" className="mt-8 scroll-mt-24">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <Sparkles className="size-5 text-amber-500" aria-hidden /> Recomendaciones para ti
            </h2>
            <p className="text-sm text-slate-600">Calculadas con tus aparatos y tus hábitos registrados.</p>
          </div>
          {potential.costMonth > 0 && (
            <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
              Ahorro potencial sin inversión: <strong>{formatCurrency(potential.costMonth)}/mes</strong> ·{" "}
              {formatNumber(potential.kwhMonth)} kWh · {formatNumber(potential.co2MonthKg)} kg CO₂
            </p>
          )}
        </div>
        <RecommendationList items={recommendations} />
        {appliances.length === 0 && (
          <Link href="/aparatos/nuevo" className="mt-3 inline-block text-sm font-semibold text-emerald-700 hover:underline">
            Registrar mi primer aparato →
          </Link>
        )}
      </section>

      {/* Historial */}
      <Card className="mt-8">
        <CardTitle>Mis registros (últimos 60 días)</CardTitle>
        {habits.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Todavía no tienes registros.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {habits.map((h) => {
              const Icon = TYPE_ICONS[h.habit_type];
              const appliance = h.appliance_id ? applianceById.get(h.appliance_id) : undefined;
              const monthKwh = habitWeeklyKwh(h, appliance?.watts) * WEEKS_PER_MONTH;
              return (
                <li key={h.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100">
                      <Icon className="size-4 text-slate-600" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">
                        {HABIT_LABELS[h.habit_type]}
                        {appliance ? `: ${appliance.name}` : ""}
                      </p>
                      <p className="text-sm text-slate-500">
                        {formatDate(h.log_date)} ·{" "}
                        {h.habit_type === "uso_aparato" ? "" : `${h.item_count} × ${formatNumber(h.watts_per_item ?? 0)} W · `}
                        {formatNumber(h.hours_per_day)} h · {h.days_per_week} días/sem
                        {h.notes ? ` · “${h.notes}”` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <p className="text-sm text-slate-600">
                      {formatNumber(monthKwh)} kWh/mes · {formatCurrency(monthKwh * profile.tariff_per_kwh)}
                    </p>
                    <ConfirmDeleteButton id={h.id} label={HABIT_LABELS[h.habit_type]} action={deleteHabit} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
