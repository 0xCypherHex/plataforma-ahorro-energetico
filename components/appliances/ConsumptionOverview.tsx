"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Coins, Leaf, Pencil, Plug, Zap } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import type { ChallengeSavingsTotals } from "@/lib/data/appliances";
import {
  PERIOD_LABELS,
  breakdownByAppliance,
  breakdownByCategory,
  calculateTotals,
  treesEquivalent,
} from "@/lib/energyCalculations";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { Appliance, Category, Period } from "@/types/database";
import { DeleteApplianceButton } from "./DeleteApplianceButton";
import { PeriodTabs } from "./PeriodTabs";

interface Props {
  appliances: Appliance[];
  categories: Category[];
  tariff: number;
  co2Factor: number;
  savings: ChallengeSavingsTotals;
}

const PERIOD_SUFFIX: Record<Period, string> = { diario: "al día", semanal: "a la semana", mensual: "al mes", anual: "al año" };

export function ConsumptionOverview({ appliances, categories, tariff, co2Factor, savings }: Props) {
  const [period, setPeriod] = useState<Period>("mensual");

  const totals = useMemo(() => calculateTotals(appliances, tariff, co2Factor), [appliances, tariff, co2Factor]);
  const byCategory = useMemo(
    () => breakdownByCategory(appliances, categories, tariff, co2Factor),
    [appliances, categories, tariff, co2Factor],
  );
  const byAppliance = useMemo(
    () => breakdownByAppliance(appliances, tariff, co2Factor),
    [appliances, tariff, co2Factor],
  );
  const categoryIcon = (slug: string) => categories.find((c) => c.slug === slug)?.icon ?? "🔌";

  return (
    <div className="space-y-4">
      <div className="max-w-md">
        <PeriodTabs value={period} onChange={setPeriod} />
      </div>

      {/* Totales del periodo */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Zap className="size-4 text-amber-500" aria-hidden /> Consumo {PERIOD_LABELS[period].toLowerCase()}
          </div>
          <p className="mt-1 text-3xl font-bold text-slate-900">
            {formatNumber(totals.kwh[period])} <span className="text-lg font-semibold text-slate-500">kWh</span>
          </p>
          <p className="mt-1 text-sm text-slate-500">{PERIOD_SUFFIX[period]}</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Coins className="size-4 text-emerald-600" aria-hidden /> Costo estimado
          </div>
          <p className="mt-1 text-3xl font-bold text-slate-900">{formatCurrency(totals.cost[period])}</p>
          <p className="mt-1 text-sm text-slate-500">Tarifa: {formatCurrency(tariff)} / kWh</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Leaf className="size-4 text-green-600" aria-hidden /> Emisiones de CO₂
          </div>
          <p className="mt-1 text-3xl font-bold text-slate-900">
            {formatNumber(totals.co2Kg[period])} <span className="text-lg font-semibold text-slate-500">kg</span>
          </p>
          <p className="mt-1 text-sm text-slate-500">
            ≈ {formatNumber(treesEquivalent(totals.co2Kg.anual), 1)} árboles para absorber lo de un año
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Por categoría */}
        <Card className="lg:col-span-2">
          <CardTitle>Consumo por categoría ({PERIOD_LABELS[period].toLowerCase()})</CardTitle>
          <ul className="mt-4 space-y-3">
            {byCategory.map((c) => (
              <li key={c.categorySlug}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium text-slate-800">
                    {c.icon} {c.categoryName}{" "}
                    <span className="font-normal text-slate-500">
                      · {c.applianceCount} {c.applianceCount === 1 ? "aparato" : "aparatos"}
                    </span>
                  </span>
                  <span className="shrink-0 text-slate-600">
                    {formatNumber(c.kwh[period])} kWh · {formatCurrency(c.cost[period])}
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${c.share}%` }} />
                </div>
                <p className="mt-0.5 text-right text-xs text-slate-500">{formatNumber(c.share, 1)}% del total</p>
              </li>
            ))}
          </ul>
        </Card>

        {/* Ahorro logrado */}
        <Card>
          <CardTitle>Ahorro logrado en retos</CardTitle>
          {savings.completed > 0 ? (
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Retos completados</dt>
                <dd className="font-semibold text-slate-900">{savings.completed}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Energía ahorrada</dt>
                <dd className="font-semibold text-slate-900">{formatNumber(savings.kwh)} kWh</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Dinero ahorrado</dt>
                <dd className="font-semibold text-slate-900">{formatCurrency(savings.cost)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">CO₂ evitado</dt>
                <dd className="font-semibold text-green-700">{formatNumber(savings.co2Kg)} kg</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              Aún no completas retos. Cuando lo hagas, aquí verás los kWh, el dinero y el CO₂ que dejaste de consumir.
            </p>
          )}
          <p className="mt-4 text-xs text-slate-500">Factor de emisión: {formatNumber(co2Factor, 3)} kg CO₂e/kWh (SEMARNAT).</p>
        </Card>
      </div>

      {/* Lista de aparatos */}
      <Card>
        <CardTitle>Mis aparatos ({appliances.length})</CardTitle>
        <ul className="mt-3 divide-y divide-slate-100">
          {byAppliance.map(({ appliance: a, kwh, cost, co2Kg, share }) => (
            <li key={a.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-lg" aria-hidden>
                  {categoryIcon(a.category_slug)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">
                    {a.name}
                    {a.quantity > 1 && <span className="font-normal text-slate-500"> × {a.quantity}</span>}
                  </p>
                  <p className="text-sm text-slate-500">
                    {formatNumber(a.watts)} W · {formatNumber(a.hours_per_day)} h/día · {a.days_per_week} días/sem
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${share}%` }} />
                    </div>
                    <span className="text-xs text-slate-500">{formatNumber(share, 1)}%</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <div className="text-left sm:text-right">
                  <p className="font-semibold text-slate-900">{formatNumber(kwh[period])} kWh</p>
                  <p className="text-sm text-slate-500">
                    {formatCurrency(cost[period])} · {formatNumber(co2Kg[period])} kg CO₂
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Link
                    href={`/aparatos/${a.id}/editar`}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"
                    aria-label={`Editar ${a.name}`}
                  >
                    <Pencil className="size-4" aria-hidden />
                    <span className="hidden sm:inline">Editar</span>
                  </Link>
                  <DeleteApplianceButton id={a.id} name={a.name} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <p className="flex items-start gap-2 text-xs text-slate-500">
        <Plug className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Estimación basada en la potencia y el tiempo de uso que registraste. El consumo real puede variar según la
        eficiencia, la antigüedad y el modo de uso de cada aparato.
      </p>
    </div>
  );
}
