"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveCatalogItem } from "@/app/admin/actions";
import { Alert } from "@/components/ui/Alert";
import { CheckboxField, Field, SelectField, TextareaField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialFormState } from "@/lib/forms";
import type { ApplianceCatalogItem, Category } from "@/types/database";

export function CatalogItemForm({ item, categories }: { item?: ApplianceCatalogItem; categories: Category[] }) {
  const [state, formAction] = useActionState(saveCatalogItem, initialFormState);
  const v = state.values;
  const e = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.message && <Alert variant="error">{state.message}</Alert>}
      <input type="hidden" name="id" value={item?.id ?? ""} />

      <Field label="Nombre" name="name" maxLength={100} defaultValue={v?.name ?? item?.name ?? ""} error={e.name} placeholder="Ej. Ventilador de torre" />
      <SelectField label="Categoría" name="category_slug" defaultValue={v?.category_slug ?? item?.category_slug ?? categories[0]?.slug} error={e.category_slug}>
        {categories.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.icon} {c.name}
            {c.is_active ? "" : " (inactiva)"}
          </option>
        ))}
      </SelectField>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Potencia aproximada (W)"
          name="default_watts"
          type="number"
          inputMode="decimal"
          min="0.01"
          max="20000"
          step="0.01"
          defaultValue={v?.default_watts ?? (item ? String(item.default_watts) : "")}
          error={e.default_watts}
        />
        <Field
          label="Horas al día (sugeridas)"
          name="default_hours_per_day"
          type="number"
          inputMode="decimal"
          min="0"
          max="24"
          step="0.05"
          defaultValue={v?.default_hours_per_day ?? (item ? String(item.default_hours_per_day) : "1")}
          error={e.default_hours_per_day}
        />
        <SelectField
          label="Días a la semana"
          name="default_days_per_week"
          defaultValue={v?.default_days_per_week ?? String(item?.default_days_per_week ?? 7)}
          error={e.default_days_per_week}
        >
          {[7, 6, 5, 4, 3, 2, 1, 0].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </SelectField>
      </div>

      <TextareaField
        label="Descripción (opcional)"
        name="description"
        rows={2}
        maxLength={500}
        defaultValue={v?.description ?? item?.description ?? ""}
        error={e.description}
        hint="Aparece como ayuda; p. ej. “12,000 BTU, más eficiente”."
      />

      <CheckboxField
        label="Visible en el catálogo"
        name="is_active"
        defaultChecked={v ? v.is_active === "on" : (item?.is_active ?? true)}
        hint="Los aparatos que los usuarios ya registraron no cambian al editar o desactivar este elemento."
      />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href="/admin/catalogo" className="rounded-xl px-4 py-2.5 text-center text-sm font-medium text-slate-600 hover:bg-slate-100">
          Cancelar
        </Link>
        <SubmitButton pendingText="Guardando…">{item ? "Guardar cambios" : "Agregar al catálogo"}</SubmitButton>
      </div>
    </form>
  );
}
