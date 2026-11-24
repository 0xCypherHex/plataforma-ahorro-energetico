"use client";

import { type FormEvent, startTransition, useActionState, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, LoaderCircle, PencilLine } from "lucide-react";
import { saveAppliance } from "@/app/(app)/aparatos/actions";
import { Alert } from "@/components/ui/Alert";
import { Card, CardTitle } from "@/components/ui/Card";
import { Field, SelectField } from "@/components/ui/Field";
import { primaryButtonClassName } from "@/components/ui/styles";
import { calculateApplianceBreakdown, validateAppliance } from "@/lib/energyCalculations";
import { formatCurrency, formatNumber } from "@/lib/format";
import { initialFormState } from "@/lib/forms";
import type { Appliance, ApplianceCatalogItem, Category } from "@/types/database";
import { CatalogPicker } from "./CatalogPicker";

interface Props {
  categories: Category[];
  catalog: ApplianceCatalogItem[];
  tariff: number;
  co2Factor: number;
  /** Si viene, el formulario edita este aparato. */
  appliance?: Appliance;
}

type Mode = "catalogo" | "manual";

interface Values {
  name: string;
  category_slug: string;
  watts: string;
  quantity: string;
  hours_per_day: string;
  days_per_week: string;
  catalog_id: string;
}

export function ApplianceForm({ categories, catalog, tariff, co2Factor, appliance }: Props) {
  const isEdit = Boolean(appliance);
  const [state, formAction, pending] = useActionState(saveAppliance, initialFormState);
  const [mode, setMode] = useState<Mode>(isEdit ? "manual" : "catalogo");
  const [values, setValues] = useState<Values>({
    name: appliance?.name ?? "",
    category_slug: appliance?.category_slug ?? categories[0]?.slug ?? "",
    watts: appliance ? String(appliance.watts) : "",
    quantity: appliance ? String(appliance.quantity) : "1",
    hours_per_day: appliance ? String(appliance.hours_per_day) : "",
    days_per_week: appliance ? String(appliance.days_per_week) : "7",
    catalog_id: appliance?.catalog_id ?? "",
  });
  const fieldsRef = useRef<HTMLDivElement>(null);

  const set = (key: keyof Values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const catalogOrigin = catalog.find((c) => c.id === values.catalog_id);
  const showFields = mode === "manual" || Boolean(values.catalog_id);

  function selectFromCatalog(item: ApplianceCatalogItem) {
    setValues((v) => ({
      ...v,
      name: item.name,
      category_slug: item.category_slug,
      watts: String(item.default_watts),
      hours_per_day: String(item.default_hours_per_day),
      days_per_week: String(item.default_days_per_week),
      catalog_id: item.id,
    }));
    requestAnimationFrame(() => fieldsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function switchMode(next: Mode) {
    setMode(next);
    if (next === "manual" && !isEdit) setValues((v) => ({ ...v, catalog_id: "" }));
  }

  // Vista previa en vivo con el mismo módulo que usa la app móvil
  const preview = useMemo(() => {
    const check = validateAppliance(values);
    return check.ok ? calculateApplianceBreakdown(check.data, tariff, co2Factor) : null;
  }, [values, tariff, co2Factor]);

  // Se envía con onSubmit (y no con <form action>) para que React 19 no reinicie
  // los campos controlados si el servidor devuelve errores de validación.
  function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const formData = new FormData(ev.currentTarget);
    startTransition(() => formAction(formData));
  }

  const e = state.fieldErrors ?? {};

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-3" noValidate>
      <input type="hidden" name="id" value={appliance?.id ?? ""} />
      <input type="hidden" name="catalog_id" value={values.catalog_id} />

      <div className="space-y-4 lg:col-span-2">
        {state.message && <Alert variant="error">{state.message}</Alert>}

        {!isEdit && (
          <Card>
            <div role="tablist" aria-label="Forma de registro" className="grid grid-cols-2 gap-2">
              {(
                [
                  { key: "catalogo", label: "Del catálogo", hint: "Potencias aproximadas", Icon: BookOpen },
                  { key: "manual", label: "Manual", hint: "Datos de la etiqueta", Icon: PencilLine },
                ] as const
              ).map(({ key, label, hint, Icon }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={mode === key}
                  onClick={() => switchMode(key)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                    mode === key
                      ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500/30"
                      : "border-slate-300 hover:border-emerald-400"
                  }`}
                >
                  <Icon className="size-5 shrink-0 text-emerald-700" aria-hidden />
                  <span>
                    <span className="block font-semibold text-slate-900">{label}</span>
                    <span className="block text-xs text-slate-500">{hint}</span>
                  </span>
                </button>
              ))}
            </div>

            {mode === "catalogo" && (
              <div className="mt-4">
                <CatalogPicker
                  catalog={catalog}
                  categories={categories}
                  selectedId={values.catalog_id || null}
                  onSelect={selectFromCatalog}
                />
              </div>
            )}
          </Card>
        )}

        {showFields && (
          <Card>
            <div ref={fieldsRef} className="scroll-mt-24 space-y-4">
              <CardTitle>{isEdit ? "Datos del aparato" : "Confirma o ajusta los datos"}</CardTitle>
              {catalogOrigin && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Valores aproximados de “{catalogOrigin.name}”. Si conoces la potencia real (viene en la etiqueta del
                  aparato), cámbiala para un cálculo más preciso.
                </p>
              )}
              {mode === "manual" && !catalogOrigin && (
                <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
                  Busca la potencia en la etiqueta o placa del aparato: aparece en watts (W). Si solo dice amperes (A),
                  multiplica A × 127 V para obtener los watts aproximados.
                </p>
              )}

              <Field label="Nombre" name="name" value={values.name} onChange={set("name")} maxLength={100} error={e.name} placeholder="Ej. TV de la sala" />

              <SelectField label="Categoría" name="category_slug" value={values.category_slug} onChange={set("category_slug")} error={e.category_slug}>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </SelectField>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Potencia (W)" name="watts" type="number" inputMode="decimal" min="0.01" max="20000" step="0.01" value={values.watts} onChange={set("watts")} error={e.watts} />
                <Field label="Cantidad de aparatos iguales" name="quantity" type="number" inputMode="numeric" min="1" max="500" step="1" value={values.quantity} onChange={set("quantity")} error={e.quantity} />
                <Field
                  label="Horas de uso al día"
                  name="hours_per_day"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="24"
                  step="0.25"
                  value={values.hours_per_day}
                  onChange={set("hours_per_day")}
                  error={e.hours_per_day}
                  hint="15 min = 0.25 · 30 min = 0.5"
                />
                <SelectField label="Días de uso a la semana" name="days_per_week" value={values.days_per_week} onChange={set("days_per_week")} error={e.days_per_week}>
                  {[7, 6, 5, 4, 3, 2, 1, 0].map((d) => (
                    <option key={d} value={d}>
                      {d} {d === 1 ? "día" : "días"}
                    </option>
                  ))}
                </SelectField>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Vista previa */}
      <div className="lg:col-span-1">
        <Card className="lg:sticky lg:top-8">
          <CardTitle>Consumo estimado</CardTitle>
          {preview ? (
            <dl className="mt-3 divide-y divide-slate-100 text-sm">
              {(["diario", "mensual", "anual"] as const).map((p) => (
                <div key={p} className="flex justify-between gap-2 py-2">
                  <dt className="capitalize text-slate-500">{p}</dt>
                  <dd className="text-right">
                    <span className="font-semibold text-slate-900">{formatNumber(preview.kwh[p])} kWh</span>
                    <span className="block text-xs text-slate-500">{formatCurrency(preview.cost[p])}</span>
                  </dd>
                </div>
              ))}
              <div className="flex justify-between gap-2 py-2">
                <dt className="text-slate-500">CO₂ al mes</dt>
                <dd className="font-semibold text-green-700">{formatNumber(preview.co2Kg.mensual)} kg</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Completa potencia, cantidad, horas y días para ver el cálculo.</p>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Fórmula: (W × horas ÷ 1000) × cantidad × días ÷ 7 = kWh/día · tarifa {formatCurrency(tariff)}/kWh
          </p>

          {showFields && (
            <div className="mt-5 flex flex-col gap-2">
              <button type="submit" disabled={pending} aria-disabled={pending} className={primaryButtonClassName}>
                {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
                {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Agregar aparato"}
              </button>
              <Link href="/aparatos" className="rounded-xl px-4 py-2.5 text-center text-sm font-medium text-slate-600 hover:bg-slate-100">
                Cancelar
              </Link>
            </div>
          )}
        </Card>
      </div>
    </form>
  );
}
