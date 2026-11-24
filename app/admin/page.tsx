import type { Metadata } from "next";
import { Building2, Plug, Shapes, Trophy, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { formatNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Administración" };

export default async function AdminHomePage() {
  const supabase = await createClient();

  const [usersRes, activeChallengesRes, catalogRes, categoriesRes, communitiesRes] = await Promise.all([
    supabase.rpc("admin_list_users", { p_limit: 500 }),
    supabase.from("challenges").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("appliance_catalog").select("id", { count: "exact", head: true }),
    supabase.from("categories").select("slug", { count: "exact", head: true }),
    supabase.from("communities").select("id", { count: "exact", head: true }),
  ]);

  const users = (usersRes.data ?? []) as { role: "user" | "admin"; account_type: "hogar" | "negocio" }[];
  const admins = users.filter((u) => u.role === "admin").length;
  const businesses = users.filter((u) => u.account_type === "negocio").length;

  const stats = [
    { label: "Usuarios", value: users.length, detail: `${admins} admin · ${businesses} negocios`, Icon: Users },
    { label: "Retos activos", value: activeChallengesRes.count ?? 0, detail: "Publicados y visibles", Icon: Trophy },
    { label: "Aparatos en catálogo", value: catalogRes.count ?? 0, detail: "Con potencias de referencia", Icon: Plug },
    { label: "Categorías", value: categoriesRes.count ?? 0, detail: "Activas e inactivas", Icon: Shapes },
    { label: "Comunidades", value: communitiesRes.count ?? 0, detail: "Colonias registradas", Icon: Building2 },
  ];

  return (
    <>
      <PageHeader title="Administración" description="Gestiona retos, catálogo, categorías y usuarios de la plataforma." />

      {usersRes.error && <Alert variant="error">No se pudo cargar la lista de usuarios: {usersRes.error.message}</Alert>}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(({ label, value, detail, Icon }) => (
          <Card key={label}>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Icon className="size-4 text-emerald-600" aria-hidden /> {label}
            </div>
            <p className="mt-1 text-3xl font-bold text-slate-900">{formatNumber(value, 0)}</p>
            <p className="mt-1 text-sm text-slate-500">{detail}</p>
          </Card>
        ))}
      </div>
    </>
  );
}
