"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { saveCategory } from "@/app/admin/actions";
import { Alert } from "@/components/ui/Alert";
import { Field } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { slugify } from "@/lib/admin/validation";
import { initialFormState } from "@/lib/forms";
import type { Category } from "@/types/database";

export function CategoryForm({ category, nextOrder }: { category?: Category; nextOrder: number }) {
  const [state, formAction] = useActionState(saveCategory, initialFormState);
  const v = state.values;
  const e = state.fieldErrors ?? {};
  const [slug, setSlug] = useState(v?.slug ?? category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(category));

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.message && <Alert variant="error">{state.message}</Alert>}
      <input type="hidden" name="original_slug" value={category?.slug ?? ""} />

      <Field
        label="Nombre"
        name="name"
        maxLength={60}
        defaultValue={v?.name ?? category?.name ?? ""}
        onChange={(ev) => {
          if (!slugTouched) setSlug(slugify(ev.target.value));
        }}
        error={e.name}
      />

      {category ? (
        <Field
          label="Identificador (slug)"
          name="slug_readonly"
          value={category.slug}
          readOnly
          disabled
          hint="No se puede cambiar: lo usan los aparatos, el catálogo y la app móvil."
        />
      ) : (
        <Field
          label="Identificador (slug)"
          name="slug"
          value={slug}
          onChange={(ev) => {
            setSlugTouched(true);
            setSlug(ev.target.value.toLowerCase());
          }}
          maxLength={40}
          error={e.slug}
          hint="Minúsculas, números y guion bajo. Se usa internamente y en la app móvil."
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ícono (emoji)" name="icon" maxLength={8} defaultValue={v?.icon ?? category?.icon ?? ""} error={e.icon} placeholder="🔌" />
        <Field
          label="Orden"
          name="sort_order"
          type="number"
          inputMode="numeric"
          min="0"
          max="10000"
          step="10"
          defaultValue={v?.sort_order ?? String(category?.sort_order ?? nextOrder)}
          error={e.sort_order}
          hint="Menor número = aparece primero."
        />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href="/admin/categorias" className="rounded-xl px-4 py-2.5 text-center text-sm font-medium text-slate-600 hover:bg-slate-100">
          Cancelar
        </Link>
        <SubmitButton pendingText="Guardando…">{category ? "Guardar cambios" : "Crear categoría"}</SubmitButton>
      </div>
    </form>
  );
}
