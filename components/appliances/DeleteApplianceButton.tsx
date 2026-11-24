"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";
import { deleteAppliance } from "@/app/(app)/aparatos/actions";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
    >
      {pending ? "Eliminando…" : "Sí, eliminar"}
    </button>
  );
}

/** Botón de eliminar con confirmación en dos pasos (sin ventanas emergentes del navegador). */
export function DeleteApplianceButton({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-700"
        aria-label={`Eliminar ${name}`}
      >
        <Trash2 className="size-4" aria-hidden />
        <span className="hidden sm:inline">Eliminar</span>
      </button>
    );
  }

  return (
    <form action={deleteAppliance} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <span className="hidden text-sm text-slate-600 sm:inline">¿Eliminar?</span>
      <ConfirmButton />
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
      >
        No
      </button>
    </form>
  );
}
