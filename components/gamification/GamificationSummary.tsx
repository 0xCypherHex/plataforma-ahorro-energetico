import { Award, Flame, Star, Trophy } from "lucide-react";
import { formatNumber } from "@/lib/format";
import type { MyGamification } from "@/types/database";

/** Franja con puntos, nivel (y progreso al siguiente), racha, retos e insignias. */
export function GamificationSummary({ g }: { g: MyGamification }) {
  const min = g.current_level_min ?? 0;
  const next = g.next_level_min;
  const progress = next ? Math.min(100, Math.round(((g.points - min) / (next - min)) * 100)) : 100;
  const earned = g.badges.filter((b) => b.earned).length;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-2 lg:col-span-1">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <Star className="size-4 text-amber-500" aria-hidden /> Nivel {g.level}
        </p>
        <p className="mt-1 text-lg font-bold text-slate-900">{g.level_name ?? "—"}</p>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progreso al siguiente nivel"
        >
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {next ? `${formatNumber(next - g.points, 0)} puntos para subir` : "Nivel máximo"}
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <Trophy className="size-4 text-emerald-600" aria-hidden /> Puntos
        </p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{formatNumber(g.points, 0)}</p>
        <p className="text-xs text-slate-500">{g.completed_challenges} retos completados</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <Flame className="size-4 text-orange-500" aria-hidden /> Racha
        </p>
        <p className="mt-1 text-2xl font-bold text-slate-900">
          {g.streak_weeks} <span className="text-base font-medium text-slate-500">{g.streak_weeks === 1 ? "semana" : "semanas"}</span>
        </p>
        <p className="text-xs text-slate-500">Completa un reto cada semana</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <Award className="size-4 text-emerald-600" aria-hidden /> Insignias
        </p>
        <p className="mt-1 text-2xl font-bold text-slate-900">
          {earned} <span className="text-base font-medium text-slate-500">de {g.badges.length}</span>
        </p>
        <p className="text-xs text-slate-500">{formatNumber(g.total_savings_kwh)} kWh ahorrados en total</p>
      </div>
    </div>
  );
}
