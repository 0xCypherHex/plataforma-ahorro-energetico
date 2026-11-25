"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveChallenge } from "@/app/admin/actions";
import { Alert } from "@/components/ui/Alert";
import { CheckboxField, Field, SelectField, TextareaField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { formatDate } from "@/lib/dates";
import { initialFormState } from "@/lib/forms";
import type { Category, Challenge } from "@/types/database";

interface Props {
  challenge?: Challenge;
  categories: Category[];
  /** Lunes disponibles para elegir la semana del reto */
  mondays: string[];
  currentWeek: string;
}

export function ChallengeForm({ challenge, categories, mondays, currentWeek }: Props) {
  const [state, formAction] = useActionState(saveChallenge, initialFormState);
  const v = state.values;
  const e = state.fieldErrors ?? {};
  const weekOptions = challenge && !mondays.includes(challenge.week_start) ? [challenge.week_start, ...mondays] : mondays;
  const weekLabel = (monday: string) => {
    const range = `${formatDate(monday, { day: "numeric", month: "short" })} – ${formatDate(
      new Date(Date.parse(`${monday}T12:00:00Z`) + 6 * 86_400_000).toISOString().slice(0, 10),
      { day: "numeric", month: "short", year: "numeric" },
    )}`;
    return monday === currentWeek ? `${range} (esta semana)` : range;
  };

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.message && <Alert variant="error">{state.message}</Alert>}
      <input type="hidden" name="id" value={challenge?.id ?? ""} />

      <Field label="Título" name="title" maxLength={120} defaultValue={v?.title ?? challenge?.title ?? ""} error={e.title} />
      <TextareaField
        label="Descripción"
        name="description"
        rows={3}
        maxLength={2000}
        defaultValue={v?.description ?? challenge?.description ?? ""}
        error={e.description}
        hint="Explica qué deben hacer los participantes durante la semana."
      />
      <TextareaField label="Consejos (opcional)" name="tips" rows={2} maxLength={2000} defaultValue={v?.tips ?? challenge?.tips ?? ""} error={e.tips} />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Categoría que mide"
          name="category_slug"
          defaultValue={v?.category_slug ?? challenge?.category_slug ?? ""}
          error={e.category_slug}
          hint="El ahorro se calcula solo con los aparatos de esta categoría."
        >
          <option value="">Todo el hogar (sin categoría)</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.icon} {c.name}
              {c.is_active ? "" : " (inactiva)"}
            </option>
          ))}
        </SelectField>
        <SelectField label="Semana" name="week_start" defaultValue={v?.week_start ?? challenge?.week_start ?? currentWeek} error={e.week_start}>
          {weekOptions.map((m) => (
            <option key={m} value={m}>
              {weekLabel(m)}
            </option>
          ))}
        </SelectField>
        <Field
          label="Meta de reducción (%)"
          name="target_reduction_pct"
          type="number"
          inputMode="decimal"
          min="0.5"
          max="100"
          step="0.5"
          defaultValue={v?.target_reduction_pct ?? String(challenge?.target_reduction_pct ?? 10)}
          error={e.target_reduction_pct}
        />
        <Field
          label="Puntos al cumplir la meta"
          name="points_reward"
          type="number"
          inputMode="numeric"
          min="0"
          max="1000"
          step="5"
          defaultValue={v?.points_reward ?? String(challenge?.points_reward ?? 50)}
          error={e.points_reward}
          hint="50 % si ahorra sin llegar a la meta · 20 % por participar."
        />
      </div>

      <CheckboxField
        label="Reto activo (visible para los usuarios)"
        name="is_active"
        defaultChecked={v ? v.is_active === "on" : (challenge?.is_active ?? true)}
        hint="Desactívalo para ocultarlo sin perder las participaciones ni los puntos ya otorgados."
      />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href="/admin/retos" className="rounded-xl px-4 py-2.5 text-center text-sm font-medium text-slate-600 hover:bg-slate-100">
          Cancelar
        </Link>
        <SubmitButton pendingText="Guardando…">{challenge ? "Guardar cambios" : "Publicar reto"}</SubmitButton>
      </div>
    </form>
  );
}
