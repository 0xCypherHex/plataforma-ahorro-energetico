import { Award, Flame, PartyPopper, Target } from "lucide-react";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import type { CompleteChallengeResult } from "@/types/database";

/** Resultado que devuelve la RPC complete_challenge (antes vs. después, puntos, racha e insignias). */
export function CompletionResult({ result }: { result: CompleteChallengeResult }) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4" role="status">
      <p className="flex items-center gap-2 font-semibold text-emerald-900">
        <PartyPopper className="size-5" aria-hidden />
        {result.target_met ? "¡Meta cumplida!" : result.savings_pct > 0 ? "¡Reto completado con ahorro!" : "Reto completado"}
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div className="rounded-xl bg-white p-2">
          <dt className="text-xs text-slate-500">Antes</dt>
          <dd className="font-semibold text-slate-900">{formatNumber(result.baseline_weekly_kwh)} kWh/sem</dd>
        </div>
        <div className="rounded-xl bg-white p-2">
          <dt className="text-xs text-slate-500">Después</dt>
          <dd className="font-semibold text-slate-900">{formatNumber(result.final_weekly_kwh)} kWh/sem</dd>
        </div>
        <div className="rounded-xl bg-white p-2">
          <dt className="text-xs text-slate-500">Ahorro</dt>
          <dd className="font-semibold text-slate-900">
            {formatPercent(result.savings_pct)} · {formatCurrency(result.savings_cost)}
          </dd>
        </div>
        <div className="rounded-xl bg-white p-2">
          <dt className="text-xs text-slate-500">CO₂ evitado</dt>
          <dd className="font-semibold text-slate-900">{formatNumber(result.savings_co2_kg)} kg</dd>
        </div>
      </dl>

      <ul className="mt-3 space-y-1 text-sm text-emerald-900">
        <li className="flex items-center gap-2">
          <Target className="size-4" aria-hidden /> Meta: {formatPercent(result.target_reduction_pct, 0)} ·{" "}
          <strong>+{result.points_awarded} puntos</strong>
        </li>
        {result.streak_bonus > 0 && (
          <li className="flex items-center gap-2">
            <Flame className="size-4" aria-hidden /> Racha de {result.streak_weeks} semanas: <strong>+{result.streak_bonus} puntos</strong>
          </li>
        )}
        {result.new_badges.map((b) => (
          <li key={b.code} className="flex items-center gap-2">
            <Award className="size-4" aria-hidden /> Nueva insignia: <strong>{b.icon} {b.name}</strong>
          </li>
        ))}
        <li>
          Total: <strong>{formatNumber(result.total_points, 0)} puntos</strong> · Nivel {result.level}
        </li>
      </ul>
      <p className="mt-3 text-xs text-emerald-800">{result.verification_note}</p>
    </div>
  );
}
