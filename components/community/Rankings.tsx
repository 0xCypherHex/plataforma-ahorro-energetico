import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import type { CommunityRankingRow, LeaderboardRow } from "@/types/database";

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function RankCell({ rank }: { rank: number }) {
  return (
    <td className="py-2.5 pr-3 font-semibold text-slate-900">
      {MEDALS[rank] ? (
        <span aria-label={`Lugar ${rank}`}>
          {MEDALS[rank]} <span className="sr-only">{rank}</span>
        </span>
      ) : (
        rank
      )}
    </td>
  );
}

/** Clasificación individual por % de ahorro estimado promedio. */
export function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-600">Todavía nadie completa retos en este periodo. ¡Sé la primera persona!</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="text-xs uppercase text-slate-500">
          <tr className="border-b border-slate-200">
            <th className="py-2 pr-3 font-medium">#</th>
            <th className="py-2 pr-3 font-medium">Participante</th>
            <th className="py-2 pr-3 text-right font-medium">Ahorro prom.</th>
            <th className="py-2 pr-3 text-right font-medium">kWh</th>
            <th className="py-2 pr-3 text-right font-medium">Retos</th>
            <th className="py-2 text-right font-medium">Nivel</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => {
            const gap = i > 0 && r.rank > rows[i - 1].rank + 1;
            return (
              <tr key={r.user_id} className={`${r.is_me ? "bg-emerald-50" : ""} ${gap ? "border-t-4 border-double border-slate-200" : ""}`}>
                <RankCell rank={r.rank} />
                <td className="py-2.5 pr-3">
                  <span className="font-medium text-slate-900">{r.display_name}</span>
                  {r.is_me && <span className="ml-2 whitespace-nowrap rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">Tú</span>}
                  {r.community_name && <span className="block text-xs text-slate-500">{r.community_name}</span>}
                </td>
                <td className="py-2.5 pr-3 text-right font-semibold text-slate-900">{formatPercent(r.avg_savings_pct)}</td>
                <td className="py-2.5 pr-3 text-right text-slate-600">{formatNumber(r.total_savings_kwh)}</td>
                <td className="py-2.5 pr-3 text-right text-slate-600">{r.completed_challenges}</td>
                <td className="py-2.5 text-right text-slate-600">
                  {r.level} <span className="text-xs">({formatNumber(r.points, 0)} pts)</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Clasificación de comunidades (ahorro colectivo) con sus reconocimientos. */
export function CommunityRankingTable({ rows, myCommunityId }: { rows: CommunityRankingRow[]; myCommunityId: string | null }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-600">Ninguna comunidad tiene retos completados en este periodo.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="text-xs uppercase text-slate-500">
          <tr className="border-b border-slate-200">
            <th className="py-2 pr-3 font-medium">#</th>
            <th className="py-2 pr-3 font-medium">Comunidad</th>
            <th className="py-2 pr-3 text-right font-medium">Participantes</th>
            <th className="py-2 pr-3 text-right font-medium">Ahorro prom.</th>
            <th className="py-2 pr-3 text-right font-medium">kWh</th>
            <th className="py-2 pr-3 text-right font-medium">Dinero</th>
            <th className="py-2 text-right font-medium">Reconocimientos</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => {
            const mine = r.community_id === myCommunityId;
            return (
              <tr key={r.community_id} className={mine ? "bg-emerald-50" : ""}>
                <RankCell rank={r.rank} />
                <td className="py-2.5 pr-3">
                  <span className="font-medium text-slate-900">{r.community_name}</span>
                  {mine && <span className="ml-2 whitespace-nowrap rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">Tu comunidad</span>}
                  {r.municipality && <span className="block text-xs text-slate-500">{r.municipality}</span>}
                </td>
                <td className="py-2.5 pr-3 text-right text-slate-600">{r.participants}</td>
                <td className="py-2.5 pr-3 text-right font-semibold text-slate-900">{formatPercent(r.avg_savings_pct)}</td>
                <td className="py-2.5 pr-3 text-right text-slate-600">{formatNumber(r.total_savings_kwh)}</td>
                <td className="py-2.5 pr-3 text-right text-slate-600">{formatCurrency(r.total_savings_cost)}</td>
                <td className="py-2.5 text-right text-slate-600">
                  {r.total_awards > 0 ? (
                    <span title={`${r.gold_awards} de oro, ${r.total_awards} en total`}>
                      🥇 {r.gold_awards} · 🏅 {r.total_awards}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
