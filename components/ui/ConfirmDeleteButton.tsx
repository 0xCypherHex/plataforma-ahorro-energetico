"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";

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

/** Eliminar con confirmación en dos pasos. `action` es una Server Action que recibe el FormData con `id`. */
export function ConfirmDeleteButton({
  id,
  label,
  action,
}: {
  id: string;
  label: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-700"
        aria-label={`Eliminar ${label}`}
      >
        <Trash2 className="size-4" aria-hidden />
        <span className="hidden sm:inline">Eliminar</span>
      </button>
    );
  }

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
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
