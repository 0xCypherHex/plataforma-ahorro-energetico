"use client";

import { type ReactNode, useActionState, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { CalendarDays, CircleCheck, LoaderCircle, Target, Trophy, Users } from "lucide-react";
import {
  type ChallengeActionState,
  abandonChallenge,
  completeChallenge,
  joinChallenge,
  logProgress,
} from "@/app/(app)/retos/actions";
import { Alert } from "@/components/ui/Alert";
import { inputClassName } from "@/components/ui/Field";
import { primaryButtonClassName } from "@/components/ui/styles";
import type { ParticipationWithChallenge } from "@/lib/data/challenges";
import { formatDate } from "@/lib/dates";
import { calculateSavings } from "@/lib/energyCalculations";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import type { ActiveChallengeRow } from "@/types/database";
import { CompletionResult } from "./CompletionResult";

const initial: ChallengeActionState = { status: "idle" };

function Pending({ children, pendingText, className }: { children: ReactNode; pendingText: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {pending ? pendingText : children}
    </button>
  );
}

function weekRange(start: string, end: string) {
  const opts = { day: "numeric", month: "short" } as const;
  return `${formatDate(start, opts)} – ${formatDate(end, opts)}`;
}

interface Props {
  challenge: ActiveChallengeRow;
  participation: ParticipationWithChallenge | null;
  categoryLabel: string | null;
  /** kWh/semana actuales de los aparatos que mide este reto (su categoría o todo el hogar). */
  currentWeeklyKwh: number;
  /** Texto de lo que mide el reto, p. ej. "tus aparatos de Iluminación". */
  measuredLabel: string;
  tariff: number;
  co2Factor: number;
  /** El usuario tiene al menos un aparato de lo que mide el reto. */
  canMeasure: boolean;
}

export function ChallengeCard({
  challenge: c,
  participation: p,
  categoryLabel,
  currentWeeklyKwh,
  measuredLabel,
  tariff,
  co2Factor,
  canMeasure,
}: Props) {
  const [joinState, joinAction] = useActionState(joinChallenge, initial);
  const [progressState, progressAction] = useActionState(logProgress, initial);
  const [completeState, completeAction] = useActionState(completeChallenge, initial);
  const [abandonState, abandonAction] = useActionState(abandonChallenge, initial);
  const [confirm, setConfirm] = useState<"none" | "complete" | "abandon">("none");

  const status = p?.status ?? null;
  const isActive = status === "activo";
  const estimate = p && isActive ? calculateSavings(p.baseline_weekly_kwh, currentWeeklyKwh, tariff, co2Factor) : null;
  const progressToTarget = estimate ? Math.min(100, Math.max(0, (estimate.pct / c.target_reduction_pct) * 100)) : 0;

  const message = [joinState, progressState, completeState, abandonState]
    .filter((s) => s.message && s.status !== "idle")
    .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))[0];

  return (
    <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header>
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
          {categoryLabel && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{categoryLabel}</span>}
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" aria-hidden /> {weekRange(c.week_start, c.week_end)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden /> {c.participants_count}
          </span>
        </div>
        <h3 className="mt-2 text-lg font-semibold text-slate-900">{c.title}</h3>
        <p className="mt-1 text-sm text-slate-600">{c.description}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-amber-900">
            <Target className="size-4" aria-hidden /> Meta: reducir {formatPercent(c.target_reduction_pct, 0)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-emerald-900">
            <Trophy className="size-4" aria-hidden /> {c.points_reward} puntos
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-500">Mide: {measuredLabel}</p>
        {c.tips && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-medium text-emerald-700">Consejos</summary>
            <p className="mt-1 text-slate-600">{c.tips}</p>
          </details>
        )}
      </header>

      <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
        {message && <Alert variant={message.status === "success" ? "success" : "error"}>{message.message}</Alert>}
        {completeState.result && <CompletionResult result={completeState.result} />}

        {/* Sin participar */}
        {(status === null || status === "abandonado") &&
          (c.can_join ? (
            canMeasure ? (
              <form action={joinAction}>
                <input type="hidden" name="challenge_id" value={c.id} />
                <Pending pendingText="Uniéndote…" className={`${primaryButtonClassName} w-full`}>
                  {status === "abandonado" ? "Volver a unirme" : "Unirme al reto"}
                </Pending>
              </form>
            ) : (
              <p className="text-sm text-slate-600">
                Este reto mide {measuredLabel}.{" "}
                <Link href="/aparatos/nuevo" className="font-semibold text-emerald-700 hover:underline">
                  Registra al menos uno
                </Link>{" "}
                para poder unirte.
              </p>
            )
          ) : (
            <p className="text-sm text-slate-500">Las inscripciones de este reto ya cerraron.</p>
          ))}

        {/* Participando */}
        {isActive && p && estimate && (
          <>
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div>
                  <p className="text-xs text-slate-500">Antes</p>
                  <p className="font-semibold text-slate-900">{formatNumber(p.baseline_weekly_kwh)} kWh</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Ahora</p>
                  <p className="font-semibold text-slate-900">{formatNumber(currentWeeklyKwh)} kWh</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Ahorro estimado</p>
                  <p className={`font-semibold ${estimate.pct >= c.target_reduction_pct ? "text-emerald-700" : "text-slate-900"}`}>
                    {formatPercent(estimate.pct)}
                  </p>
                </div>
              </div>
              <div
                className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"
                role="progressbar"
                aria-valuenow={Math.round(progressToTarget)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Avance hacia la meta"
              >
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progressToTarget}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                kWh por semana de {measuredLabel}. Ahorro semanal ≈ {formatCurrency(estimate.weeklyCost)} ·{" "}
                {formatNumber(estimate.weeklyCo2Kg)} kg CO₂.{" "}
                <Link href="/aparatos" className="font-semibold text-emerald-700 hover:underline">
                  Actualizar aparatos
                </Link>
              </p>
            </div>

            <form action={progressAction} className="space-y-2">
              <input type="hidden" name="participation_id" value={p.id} />
              <label htmlFor={`note-${p.id}`} className="block text-sm font-medium text-slate-700">
                Registrar avance de hoy
              </label>
              <textarea
                id={`note-${p.id}`}
                name="note"
                rows={2}
                maxLength={1000}
                placeholder="Ej. Hoy desconecté la TV y el decodificador al dormir."
                className={inputClassName}
              />
              <details className="text-sm">
                <summary className="cursor-pointer text-slate-600">Lectura de medidor (opcional)</summary>
                <input
                  name="meter_reading_kwh"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.001"
                  placeholder="kWh que marca tu medidor"
                  aria-label="Lectura del medidor en kWh"
                  className={`${inputClassName} mt-2`}
                />
                <p className="mt-1 text-xs text-slate-500">Se guarda para una futura verificación con datos reales.</p>
              </details>
              <Pending pendingText="Guardando…" className="w-full rounded-xl border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60">
                Registrar avance (+5 puntos al día)
              </Pending>
            </form>

            {confirm === "complete" ? (
              <form action={completeAction} className="space-y-2 rounded-xl border border-emerald-200 p-3">
                <input type="hidden" name="participation_id" value={p.id} />
                <p className="text-sm text-slate-700">
                  Se comparará tu consumo actual (<strong>{formatNumber(currentWeeklyKwh)} kWh/sem</strong>) con el de inicio. ¿Ya
                  actualizaste tus aparatos?
                </p>
                <div className="flex gap-2">
                  <Pending pendingText="Verificando…" className={`${primaryButtonClassName} flex-1`}>
                    Sí, completar reto
                  </Pending>
                  <button type="button" onClick={() => setConfirm("none")} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
                    Aún no
                  </button>
                </div>
              </form>
            ) : confirm === "abandon" ? (
              <form action={abandonAction} className="flex items-center gap-2 rounded-xl border border-red-200 p-3">
                <input type="hidden" name="participation_id" value={p.id} />
                <p className="flex-1 text-sm text-slate-700">¿Abandonar este reto?</p>
                <Pending pendingText="…" className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700">
                  Sí, abandonar
                </Pending>
                <button type="button" onClick={() => setConfirm("none")} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
                  No
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setConfirm("complete")} className={`${primaryButtonClassName} flex-1`}>
                  <CircleCheck className="size-5" aria-hidden /> Completar reto
                </button>
                <button type="button" onClick={() => setConfirm("abandon")} className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-700">
                  Abandonar
                </button>
              </div>
            )}
          </>
        )}

        {/* Completado */}
        {status === "completado" && p && !completeState.result && (
          <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
            <p className="flex items-center gap-2 font-semibold">
              <CircleCheck className="size-4" aria-hidden /> {p.target_met ? "Meta cumplida" : "Reto completado"} · +{p.points_awarded} puntos
            </p>
            <p className="mt-1">
              Ahorro {formatPercent(p.savings_pct)} · {formatNumber(Math.max(p.savings_kwh ?? 0, 0))} kWh ·{" "}
              {formatCurrency(p.savings_cost)} · {formatNumber(p.savings_co2_kg)} kg CO₂
            </p>
          </div>
        )}
      </div>
    </article>
  );
}
