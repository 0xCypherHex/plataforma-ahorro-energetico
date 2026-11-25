import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { duplicateChallenge, toggleChallenge } from "@/app/admin/actions";
import { DuplicateButton, StatusBadge, ToggleActiveButton } from "@/components/admin/AdminControls";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { primaryButtonClassName } from "@/components/ui/styles";
import { getAllChallenges } from "@/lib/data/admin";
import { getCategories } from "@/lib/data/appliances";
import { addDays, formatDate, todayIn, weekStartOf } from "@/lib/dates";
import { formatPercent } from "@/lib/format";

export const metadata: Metadata = { title: "Admin · Retos" };

const OK: Record<string, string> = {
  creado: "Reto publicado.",
  actualizado: "Reto actualizado.",
  duplicado: "Reto copiado a la semana siguiente.",
};

export default async function AdminChallengesPage(props: PageProps<"/admin/retos">) {
  const searchParams = await props.searchParams;
  const [challenges, categories] = await Promise.all([getAllChallenges(), getCategories()]);
  const currentWeek = weekStartOf(todayIn());
  const ok = typeof searchParams.ok === "string" ? OK[searchParams.ok] : undefined;

  // Agrupar por semana (más reciente primero)
  const weeks = [...new Set(challenges.map((c) => c.week_start))];
  const label = (slug: string | null) => {
    if (!slug) return "Todo el hogar";
    const c = categories.find((x) => x.slug === slug);
    return c ? `${c.icon ?? ""} ${c.name}`.trim() : slug;
  };
  const weekTitle = (w: string) => {
    const range = `${formatDate(w, { day: "numeric", month: "short" })} – ${formatDate(addDays(w, 6), { day: "numeric", month: "short", year: "numeric" })}`;
    if (w === currentWeek) return `${range} · esta semana`;
    return w > currentWeek ? `${range} · próxima` : `${range} · pasada`;
  };

  return (
    <>
      <PageHeader
        title="Retos semanales"
        description="Publica los retos de cada semana. Un reto desactivado deja de verse, pero conserva participaciones y puntos."
        actions={
          <Link href="/admin/retos/nuevo" className={primaryButtonClassName}>
            <Plus className="size-5" aria-hidden /> Nuevo reto
          </Link>
        }
      />
      {ok && (
        <div className="mb-4">
          <Alert variant="success">{ok}</Alert>
        </div>
      )}
      {!weeks.includes(currentWeek) && (
        <div className="mb-4">
          <Alert variant="info">No hay retos publicados para esta semana. Crea uno o copia los de la semana pasada.</Alert>
        </div>
      )}

      <div className="space-y-6">
        {weeks.map((w) => (
          <section key={w}>
            <h2 className={`mb-2 text-sm font-semibold ${w === currentWeek ? "text-emerald-700" : "text-slate-600"}`}>{weekTitle(w)}</h2>
            <Card className="p-0">
              <ul className="divide-y divide-slate-100">
                {challenges
                  .filter((c) => c.week_start === w)
                  .map((c) => (
                    <li key={c.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">{c.title}</p>
                          <StatusBadge active={c.is_active} />
                        </div>
                        <p className="mt-0.5 text-sm text-slate-500">
                          {label(c.category_slug)} · meta {formatPercent(c.target_reduction_pct, 0)} · {c.points_reward} pts ·{" "}
                          {c.participants} participantes · {c.completed} completados
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <Link
                          href={`/admin/retos/${c.id}/editar`}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"
                        >
                          <Pencil className="size-4" aria-hidden /> Editar
                        </Link>
                        <DuplicateButton id={c.id} action={duplicateChallenge} />
                        <ToggleActiveButton id={c.id} active={c.is_active} action={toggleChallenge} />
                      </div>
                    </li>
                  ))}
              </ul>
            </Card>
          </section>
        ))}
      </div>
    </>
  );
}
