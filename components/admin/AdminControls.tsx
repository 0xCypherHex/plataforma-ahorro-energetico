"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Copy, Power } from "lucide-react";

function Submit({ children, className }: { children: ReactNode; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-60`}>
      {pending ? "…" : children}
    </button>
  );
}

/** Activa / desactiva un registro. `action` recibe FormData con `id` y `active` (estado actual). */
export function ToggleActiveButton({
  id,
  active,
  action,
}: {
  id: string;
  active: boolean;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={String(active)} />
      <Submit
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium ${
          active ? "text-slate-600 hover:bg-amber-50 hover:text-amber-800" : "text-emerald-700 hover:bg-emerald-50"
        }`}
      >
        <Power className="size-4" aria-hidden />
        {active ? "Desactivar" : "Activar"}
      </Submit>
    </form>
  );
}

export function DuplicateButton({ id, action }: { id: string; action: (formData: FormData) => Promise<void> }) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <Submit className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
        <Copy className="size-4" aria-hidden />
        Copiar a la semana siguiente
      </Submit>
    </form>
  );
}

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        active ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"
      }`}
    >
      <span className={`size-1.5 rounded-full ${active ? "bg-emerald-600" : "bg-slate-400"}`} aria-hidden />
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}
