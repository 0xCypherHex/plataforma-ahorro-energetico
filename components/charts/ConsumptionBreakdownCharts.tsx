"use client";

import { useMemo, useState } from "react";
import { PeriodTabs } from "@/components/appliances/PeriodTabs";
import { PERIOD_LABELS, breakdownByAppliance, breakdownByCategory } from "@/lib/energyCalculations";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { Appliance, Category, Period } from "@/types/database";
import { type BarDatum, HorizontalBarChart } from "./HorizontalBarChart";

type Metric = "kwh" | "cost";
const MAX_APPLIANCES = 8;

function formatMetric(metric: Metric, kwh: number, cost: number) {
  return metric === "kwh" ? `${formatNumber(kwh)} kWh` : formatCurrency(cost);
}

function secondary(metric: Metric, kwh: number, cost: number) {
  return metric === "kwh" ? formatCurrency(cost) : `${formatNumber(kwh)} kWh`;
}

interface Props {
  appliances: Appliance[];
  categories: Category[];
  tariff: number;
  co2Factor: number;
}

/** Gráficas de consumo por categoría y por aparato, con selector de periodo y de unidad. */
export function ConsumptionBreakdownCharts({ appliances, categories, tariff, co2Factor }: Props) {
  const [period, setPeriod] = useState<Period>("mensual");
  const [metric, setMetric] = useState<Metric>("kwh");

  const categoryData = useMemo<BarDatum[]>(
    () =>
      breakdownByCategory(appliances, categories, tariff, co2Factor).map((c) => ({
        name: c.categoryName,
        value: metric === "kwh" ? c.kwh[period] : c.cost[period],
        valueLabel: formatMetric(metric, c.kwh[period], c.cost[period]),
        details: [
          secondary(metric, c.kwh[period], c.cost[period]),
          `${formatNumber(c.co2Kg[period])} kg CO₂`,
          `${formatNumber(c.share, 1)}% del total`,
        ],
      })),
    [appliances, categories, tariff, co2Factor, period, metric],
  );

  const applianceData = useMemo<BarDatum[]>(() => {
    const rows = breakdownByAppliance(appliances, tariff, co2Factor);
    const top = rows.slice(0, MAX_APPLIANCES);
    const rest = rows.slice(MAX_APPLIANCES);
    const data: BarDatum[] = top.map((r) => ({
      name: r.appliance.quantity > 1 ? `${r.appliance.name} ×${r.appliance.quantity}` : r.appliance.name,
      value: metric === "kwh" ? r.kwh[period] : r.cost[period],
      valueLabel: formatMetric(metric, r.kwh[period], r.cost[period]),
      details: [
        secondary(metric, r.kwh[period], r.cost[period]),
        `${formatNumber(r.co2Kg[period])} kg CO₂`,
        `${formatNumber(r.share, 1)}% del total`,
      ],
    }));
    if (rest.length > 0) {
      const kwh = rest.reduce((s, r) => s + r.kwh[period], 0);
      const cost = rest.reduce((s, r) => s + r.cost[period], 0);
      const share = rest.reduce((s, r) => s + r.share, 0);
      data.push({
        name: `Otros (${rest.length})`,
        value: metric === "kwh" ? kwh : cost,
        valueLabel: formatMetric(metric, kwh, cost),
        details: [`${formatNumber(share, 1)}% del total`],
      });
    }
    return data;
  }, [appliances, tariff, co2Factor, period, metric]);

  const periodText = PERIOD_LABELS[period].toLowerCase();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-md">
          <PeriodTabs value={period} onChange={setPeriod} />
        </div>
        <div role="tablist" aria-label="Unidad" className="grid w-full grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:w-48">
          {(
            [
              ["kwh", "kWh"],
              ["cost", "Costo $"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={metric === key}
              onClick={() => setMetric(key)}
              className={`rounded-lg px-2 py-2 text-sm font-medium transition ${
                metric === key ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Por categoría ({periodText})</h3>
          <HorizontalBarChart data={categoryData} ariaLabel={`Consumo ${periodText} por categoría`} />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Por aparato ({periodText})</h3>
          <HorizontalBarChart data={applianceData} ariaLabel={`Consumo ${periodText} por aparato`} />
        </div>
      </div>
    </div>
  );
}
