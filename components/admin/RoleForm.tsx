"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { setUserRole } from "@/app/admin/actions";
import type { UserRole } from "@/types/database";

function Save({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? "…" : "Guardar"}
    </button>
  );
}

/** Cambia el rol de un usuario con la RPC admin_set_user_role (la BD impide quitarte tu propio rol). */
export function RoleForm({ userId, role, isSelf }: { userId: string; role: UserRole; isSelf: boolean }) {
  const [value, setValue] = useState<UserRole>(role);
  return (
    <form action={setUserRole} className="flex items-center gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <select
        name="role"
        value={value}
        onChange={(e) => setValue(e.target.value as UserRole)}
        disabled={isSelf}
        aria-label="Rol"
        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:bg-slate-100"
      >
        <option value="user">Usuario</option>
        <option value="admin">Administrador</option>
      </select>
      <Save disabled={isSelf || value === role} />
    </form>
  );
}
