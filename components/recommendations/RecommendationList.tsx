import { ArrowUpRight, CircleDollarSign, Clock, Hammer, Leaf } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { EFFORT_LABELS, PRIORITY_LABELS, type Recommendation } from "@/lib/recommendations";

const PRIORITY_STYLES = {
  alta: "bg-slate-900 text-white",
  media: "bg-slate-200 text-slate-800",
  baja: "bg-slate-100 text-slate-600",
} as const;

const EFFORT_ICONS = { sin_costo: Clock, bajo_costo: CircleDollarSign, inversion: Hammer } as const;

/** Lista de recomendaciones. `compact` muestra solo título y ahorro (para el panel). */
export function RecommendationList({ items, compact = false }: { items: Recommendation[]; compact?: boolean }) {
  return (
    <ul className={compact ? "divide-y divide-slate-100" : "grid gap-3 md:grid-cols-2"}>
      {items.map((r) => {
        const EffortIcon = EFFORT_ICONS[r.effort];
        const hasSavings = r.savings.kwhMonth > 0;
        if (compact) {
          return (
            <li key={r.id} className="flex items-start gap-3 py-3">
              <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">{r.title}</p>
                {hasSavings && (
                  <p className="text-sm text-slate-500">
                    Ahorro ≈ {formatCurrency(r.savings.costMonth)}/mes · {formatNumber(r.savings.kwhMonth)} kWh
                  </p>
                )}
              </div>
            </li>
          );
        }
        return (
          <li key={r.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
              <span className={`rounded-full px-2 py-0.5 ${PRIORITY_STYLES[r.priority]}`}>{PRIORITY_LABELS[r.priority]}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800">
                <EffortIcon className="size-3.5" aria-hidden /> {EFFORT_LABELS[r.effort]}
              </span>
            </div>
            <h3 className="mt-2 font-semibold text-slate-900">{r.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{r.description}</p>
            {r.actions.length > 0 && (
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-slate-600">
                {r.actions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}
            {hasSavings && (
              <div className="mt-auto pt-3">
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-semibold text-slate-900">≈ {formatCurrency(r.savings.costMonth)} al mes</span>
                  <span className="text-slate-600">{formatNumber(r.savings.kwhMonth)} kWh</span>
                  <span className="inline-flex items-center gap-1 text-slate-600">
                    <Leaf className="size-3.5 text-green-600" aria-hidden /> {formatNumber(r.savings.co2MonthKg)} kg CO₂
                  </span>
                </p>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
