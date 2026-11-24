"use client";

import { type FormEvent, startTransition, useActionState, useMemo, useState } from "react";
import { Lightbulb, LoaderCircle, PlugZap, Timer } from "lucide-react";
import { saveHabit } from "@/app/(app)/habitos/actions";
import { Alert } from "@/components/ui/Alert";
import { Field, SelectField } from "@/components/ui/Field";
import { primaryButtonClassName } from "@/components/ui/styles";
import { HABIT_DEFAULT_WATTS, WEEKS_PER_MONTH, habitWeeklyKwh, validateHabit } from "@/lib/energyCalculations";
import { formatCurrency, formatNumber } from "@/lib/format";
import { initialFormState } from "@/lib/forms";
import type { Appliance, HabitType } from "@/types/database";

const TYPES: { value: HabitType; label: string; hint: string; Icon: typeof Lightbulb }[] = [
  { value: "luces_sin_necesidad", label: "Luces sin necesidad", hint: "Focos encendidos sin nadie", Icon: Lightbulb },
  { value: "dispositivos_standby", label: "Aparatos en espera", hint: "Conectados sin usarse", Icon: PlugZap },
  { value: "uso_aparato", label: "Uso de un aparato", hint: "Horas reales de uso", Icon: Timer },
];

interface Props {
  appliances: Pick<Appliance, "id" | "name" | "watts">[];
  today: string;
  tariff: number;
  co2Factor: number;
}

export function HabitForm({ appliances, today, tariff, co2Factor }: Props) {
  const [state, formAction, pending] = useActionState(saveHabit, initialFormState);
  const [values, setValues] = useState({
    habit_type: "luces_sin_necesidad" as HabitType,
    log_date: today,
    appliance_id: appliances[0]?.id ?? "",
    item_count: "1",
    watts_per_item: "",
    hours_per_day: "",
    days_per_week: "7",
    notes: "",
  });
  const set = (key: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const type = values.habit_type;
  const isUsage = type === "uso_aparato";
  const selectedAppliance = appliances.find((a) => a.id === values.appliance_id);

  const estimate = useMemo(() => {
    const check = validateHabit(values, appliances.map((a) => a.id));
    if (!check.ok) return null;
    const weekly = habitWeeklyKwh(
      {
        habit_type: check.data.habit_type,
        item_count: check.data.item_count ?? 1,
        watts_per_item: check.data.watts_per_item ?? null,
        hours_per_day: check.data.hours_per_day,
        days_per_week: check.data.days_per_week ?? 7,
      },
      selectedAppliance?.watts,
    );
    const month = weekly * WEEKS_PER_MONTH;
    return { kwh: month, cost: month * tariff, co2: month * co2Factor };
  }, [values, appliances, selectedAppliance, tariff, co2Factor]);

  function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const formData = new FormData(ev.currentTarget);
    startTransition(() => formAction(formData));
  }

  const e = state.fieldErrors ?? {};
  const defaultWatts = isUsage ? selectedAppliance?.watts : HABIT_DEFAULT_WATTS[type as Exclude<HabitType, "uso_aparato">];

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {state.message && <Alert variant="error">{state.message}</Alert>}
      <input type="hidden" name="habit_type" value={type} />

      <fieldset>
        <legend className="mb-2 block text-sm font-medium text-slate-700">¿Qué quieres registrar?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {TYPES.map(({ value, label, hint, Icon }) => {
            const active = type === value;
            const disabled = value === "uso_aparato" && appliances.length === 0;
            return (
              <button
                key={value}
                type="button"
                disabled={disabled}
                aria-pressed={active}
                onClick={() => setValues((v) => ({ ...v, habit_type: value }))}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  active ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500/30" : "border-slate-300 hover:border-emerald-400"
                }`}
              >
                <Icon className="size-5 shrink-0 text-emerald-700" aria-hidden />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{label}</span>
                  <span className="block text-xs text-slate-500">{disabled ? "Registra aparatos primero" : hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        {isUsage ? (
          <SelectField label="Aparato" name="appliance_id" value={values.appliance_id} onChange={set("appliance_id")} error={e.appliance_id}>
            {appliances.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </SelectField>
        ) : (
          <Field
            label={type === "luces_sin_necesidad" ? "Focos encendidos sin necesidad" : "Aparatos conectados sin usarse"}
            name="item_count"
            type="number"
            inputMode="numeric"
            min="1"
            max="500"
            step="1"
            value={values.item_count}
            onChange={set("item_count")}
            error={e.item_count}
          />
        )}
        <Field
          label={isUsage ? "Horas reales de uso ese día" : "¿Cuántas horas así?"}
          name="hours_per_day"
          type="number"
          inputMode="decimal"
          min="0.25"
          max="24"
          step="0.25"
          value={values.hours_per_day}
          onChange={set("hours_per_day")}
          error={e.hours_per_day}
        />
        <SelectField
          label="¿Cuántos días a la semana pasa esto?"
          name="days_per_week"
          value={values.days_per_week}
          onChange={set("days_per_week")}
          error={e.days_per_week}
        >
          {[7, 6, 5, 4, 3, 2, 1].map((d) => (
            <option key={d} value={d}>
              {d} {d === 1 ? "día" : "días"}
            </option>
          ))}
        </SelectField>
        <Field label="Fecha del registro" name="log_date" type="date" max={today} value={values.log_date} onChange={set("log_date")} error={e.log_date} />
      </div>

      <details className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium text-slate-700">Opciones avanzadas</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {!isUsage && (
            <Field
              label="Potencia por unidad (W)"
              name="watts_per_item"
              type="number"
              inputMode="decimal"
              min="0"
              max="20000"
              step="0.5"
              placeholder={`${defaultWatts ?? ""} (por defecto)`}
              value={values.watts_per_item}
              onChange={set("watts_per_item")}
              error={e.watts_per_item}
              hint={type === "luces_sin_necesidad" ? "LED ≈ 9 W · ahorrador ≈ 20 W · incandescente ≈ 60 W" : "Promedio de un aparato en espera ≈ 5 W"}
            />
          )}
          <Field label="Notas (opcional)" name="notes" maxLength={500} value={values.notes} onChange={set("notes")} error={e.notes} />
        </div>
      </details>

      <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          {estimate ? (
            <>
              {isUsage ? "Consumo de este uso" : "Desperdicio estimado"}:{" "}
              <strong className="text-slate-900">{formatNumber(estimate.kwh)} kWh/mes</strong> ·{" "}
              {formatCurrency(estimate.cost)} · {formatNumber(estimate.co2)} kg CO₂
            </>
          ) : (
            "Completa los datos para ver el impacto estimado."
          )}
        </p>
        <button type="submit" disabled={pending} className={`${primaryButtonClassName} shrink-0`}>
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {pending ? "Guardando…" : "Registrar hábito"}
        </button>
      </div>
    </form>
  );
}
