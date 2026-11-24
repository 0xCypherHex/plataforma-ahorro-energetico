import { Lock } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { POINTS_REASON_LABELS, formatNumber } from "@/lib/format";
import type { GamificationBadge, Level, PointsLedgerEntry } from "@/types/database";

export function BadgeGrid({ badges }: { badges: GamificationBadge[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {badges.map((b) => (
        <li
          key={b.code}
          className={`rounded-2xl border p-3 text-center ${b.earned ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}
        >
          <span className={`text-3xl ${b.earned ? "" : "opacity-30 grayscale"}`} aria-hidden>
            {b.icon ?? "🏅"}
          </span>
          <p className={`mt-1 text-sm font-semibold ${b.earned ? "text-slate-900" : "text-slate-500"}`}>{b.name}</p>
          <p className="mt-0.5 text-xs text-slate-500">{b.description}</p>
          <p className="mt-1 text-xs font-medium">
            {b.earned && b.awarded_at ? (
              <span className="text-emerald-700">
                Obtenida el {new Date(b.awarded_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-slate-400">
                <Lock className="size-3" aria-hidden /> Bloqueada
              </span>
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function LevelLadder({ levels, currentLevel, points }: { levels: Level[]; currentLevel: number; points: number }) {
  return (
    <ol className="space-y-2">
      {levels.map((l) => {
        const reached = points >= l.min_points;
        const current = l.level === currentLevel;
        return (
          <li
            key={l.level}
            aria-current={current ? "step" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${
              current ? "bg-emerald-600 text-white" : reached ? "bg-emerald-50 text-emerald-900" : "bg-slate-50 text-slate-500"
            }`}
          >
            <span className="w-6 text-center font-bold">{l.level}</span>
            <span className="flex-1 font-medium">{l.name}</span>
            <span className="text-xs">{formatNumber(l.min_points, 0)} pts</span>
          </li>
        );
      })}
    </ol>
  );
}

export function PointsHistory({ entries }: { entries: PointsLedgerEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-600">Aún no tienes movimientos de puntos.</p>;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {entries.map((e) => (
        <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{e.description ?? POINTS_REASON_LABELS[e.reason]}</p>
            <p className="text-xs text-slate-500">
              {POINTS_REASON_LABELS[e.reason]} ·{" "}
              {new Date(e.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
            </p>
          </div>
          <span className={`shrink-0 font-semibold ${e.points >= 0 ? "text-emerald-700" : "text-red-600"}`}>
            {e.points >= 0 ? "+" : ""}
            {e.points}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Sección "Mis logros": insignias, niveles e historial de puntos. */
export function Achievements({
  badges,
  levels,
  currentLevel,
  points,
  history,
}: {
  badges: GamificationBadge[];
  levels: Level[];
  currentLevel: number;
  points: number;
  history: PointsLedgerEntry[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardTitle>Insignias</CardTitle>
        <div className="mt-4">
          <BadgeGrid badges={badges} />
        </div>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardTitle>Niveles</CardTitle>
          <div className="mt-3">
            <LevelLadder levels={levels} currentLevel={currentLevel} points={points} />
          </div>
        </Card>
        <Card>
          <CardTitle>Últimos puntos</CardTitle>
          <div className="mt-2">
            <PointsHistory entries={history} />
          </div>
        </Card>
      </div>
    </div>
  );
}
