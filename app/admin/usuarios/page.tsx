import type { Metadata } from "next";
import { Search } from "lucide-react";
import { RoleForm } from "@/components/admin/RoleForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { inputClassName } from "@/components/ui/Field";
import { requireAdmin } from "@/lib/auth";
import { listUsers } from "@/lib/data/admin";
import { ACCOUNT_TYPE_LABELS, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Admin · Usuarios" };

export default async function AdminUsersPage(props: PageProps<"/admin/usuarios">) {
  const searchParams = await props.searchParams;
  const me = await requireAdmin();
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const users = await listUsers(q);
  const error = typeof searchParams.error === "string" ? searchParams.error : undefined;

  return (
    <>
      <PageHeader title="Usuarios" description="Consulta las cuentas registradas y asigna el rol de administrador." />
      {(error || searchParams.ok === "rol") && (
        <div className="mb-4">
          <Alert variant={error ? "error" : "success"}>{error ?? "Rol actualizado."}</Alert>
        </div>
      )}
      <form method="get" className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input name="q" defaultValue={q} placeholder="Buscar por nombre o correo" aria-label="Buscar" className={`${inputClassName} pl-9`} />
        </div>
        <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
          Buscar
        </button>
      </form>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Comunidad</th>
                <th className="px-4 py-3 text-right font-medium">Puntos</th>
                <th className="px-4 py-3 font-medium">Alta</th>
                <th className="px-4 py-3 font-medium">Rol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{u.full_name || "Sin nombre"}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{ACCOUNT_TYPE_LABELS[u.account_type]}</td>
                  <td className="px-4 py-3 text-slate-600">{u.community_name ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {formatNumber(u.points, 0)} <span className="text-xs">(nv. {u.level})</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{new Date(u.created_at).toLocaleDateString("es-MX", { dateStyle: "medium" })}</td>
                  <td className="px-4 py-3">
                    <RoleForm userId={u.id} role={u.role} isSelf={u.id === me.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && <p className="p-6 text-sm text-slate-600">Sin resultados.</p>}
      </Card>
      <p className="mt-2 text-xs text-slate-500">Se muestran hasta 200 usuarios. No puedes quitarte tu propio rol de administrador.</p>
    </>
  );
}
