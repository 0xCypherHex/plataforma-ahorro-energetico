"use client";

import { PERIOD_LABELS } from "@/lib/energyCalculations";
import { PERIODS, type Period } from "@/types/database";

/** Selector segmentado Diario / Semanal / Mensual / Anual. */
export function PeriodTabs({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div role="tablist" aria-label="Periodo" className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1">
      {PERIODS.map((p) => {
        const active = p === value;
        return (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(p)}
            className={`rounded-lg px-2 py-2 text-sm font-medium transition ${
              active ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        );
      })}
    </div>
  );
}
