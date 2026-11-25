import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Medal, Plug, Shapes, Trophy, Users } from "lucide-react";
import { GrantAwardsForm } from "@/components/admin/GrantAwardsForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Card, CardTitle } from "@/components/ui/Card";
import { addDays, formatDate, todayIn, weekStartOf } from "@/lib/dates";
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
    { label: "Usuarios", value: users.length, detail: `${admins} admin · ${businesses} negocios`, Icon: Users, href: "/admin/usuarios" },
    { label: "Retos activos", value: activeChallengesRes.count ?? 0, detail: "Publicados y visibles", Icon: Trophy, href: "/admin/retos" },
    { label: "Aparatos en catálogo", value: catalogRes.count ?? 0, detail: "Con potencias de referencia", Icon: Plug, href: "/admin/catalogo" },
    { label: "Categorías", value: categoriesRes.count ?? 0, detail: "Activas e inactivas", Icon: Shapes, href: "/admin/categorias" },
    { label: "Comunidades", value: communitiesRes.count ?? 0, detail: "Colonias registradas", Icon: Building2, href: "/comunidad?ambito=global" },
  ];

  // Semanas que se pueden premiar: la pasada (por defecto) y las 7 anteriores
  const lastWeek = addDays(weekStartOf(todayIn()), -7);
  const awardWeeks = Array.from({ length: 8 }, (_, i) => addDays(lastWeek, -7 * i));
  const { data: recentAwards } = await supabase
    .from("community_awards")
    .select("period_start, award, rank, avg_savings_pct, community:communities(name)")
    .order("period_start", { ascending: false })
    .order("rank")
    .limit(9);

  return (
    <>
      <PageHeader title="Administración" description="Gestiona retos, catálogo, categorías y usuarios de la plataforma." />

      {usersRes.error && <Alert variant="error">No se pudo cargar la lista de usuarios: {usersRes.error.message}</Alert>}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(({ label, value, detail, Icon, href }) => (
          <Link key={label} href={href} className="rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md">
            <Card className="h-full">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <Icon className="size-4 text-emerald-600" aria-hidden /> {label}
              </div>
              <p className="mt-1 text-3xl font-bold text-slate-900">{formatNumber(value, 0)}</p>
              <p className="mt-1 text-sm text-slate-500">{detail}</p>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-6">
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            <Medal className="size-5 text-amber-500" aria-hidden /> Reconocimientos comunitarios
          </span>
        </CardTitle>
        <p className="mb-4 mt-1 text-sm text-slate-600">
          Entrega oro, plata y bronce a las tres comunidades con mayor ahorro promedio en los retos de una semana. Hazlo cada
          lunes para la semana anterior; repetirlo no duplica premios.
        </p>
        <GrantAwardsForm weeks={awardWeeks} defaultWeek={lastWeek} />
        {recentAwards && recentAwards.length > 0 && (
          <ul className="mt-5 divide-y divide-slate-100 text-sm">
            {recentAwards.map((a) => {
              const community = Array.isArray(a.community) ? a.community[0] : a.community;
              return (
                <li key={`${a.period_start}-${a.rank}`} className="flex justify-between gap-2 py-2">
                  <span>
                    {{ oro: "🥇", plata: "🥈", bronce: "🥉" }[a.award as "oro" | "plata" | "bronce"]} {community?.name ?? "Comunidad"}
                  </span>
                  <span className="text-slate-500">
                    {formatDate(a.period_start as string, { day: "numeric", month: "short" })} · {formatNumber(Number(a.avg_savings_pct), 1)} %
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
