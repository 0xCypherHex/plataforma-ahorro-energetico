import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { deleteCategory, toggleCategory } from "@/app/admin/actions";
import { StatusBadge, ToggleActiveButton } from "@/components/admin/AdminControls";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { primaryButtonClassName } from "@/components/ui/styles";
import { getAllCategories } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Admin · Categorías" };

const OK: Record<string, string> = { creada: "Categoría creada.", actualizada: "Categoría actualizada.", eliminada: "Categoría eliminada." };
const ERR: Record<string, string> = {
  "en-uso": "No se puede eliminar: hay aparatos o elementos del catálogo con esa categoría. Desactívala en su lugar.",
  desconocido: "No se pudo eliminar la categoría.",
};

export default async function AdminCategoriesPage(props: PageProps<"/admin/categorias">) {
  const searchParams = await props.searchParams;
  const categories = await getAllCategories();
  const ok = typeof searchParams.ok === "string" ? OK[searchParams.ok] : undefined;
  const err = typeof searchParams.error === "string" ? ERR[searchParams.error] : undefined;

  return (
    <>
      <PageHeader
        title="Categorías"
        description="Agrupan los aparatos y los retos. Una categoría inactiva deja de ofrecerse en formularios nuevos."
        actions={
          <Link href="/admin/categorias/nuevo" className={primaryButtonClassName}>
            <Plus className="size-5" aria-hidden /> Nueva categoría
          </Link>
        }
      />
      {(ok || err) && (
        <div className="mb-4">
          <Alert variant={err ? "error" : "success"}>{err ?? ok}</Alert>
        </div>
      )}
      <Card className="p-0">
        <ul className="divide-y divide-slate-100">
          {categories.map((c) => {
            const inUse = c.catalogCount + c.applianceCount > 0;
            return (
              <li key={c.slug} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-xl" aria-hidden>
                  {c.icon ?? "•"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{c.name}</p>
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{c.slug}</code>
                    <StatusBadge active={c.is_active} />
                  </div>
                  <p className="text-sm text-slate-500">
                    Orden {c.sort_order} · {c.catalogCount} en catálogo · {c.applianceCount} aparatos de usuarios
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Link
                    href={`/admin/categorias/${c.slug}/editar`}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"
                  >
                    <Pencil className="size-4" aria-hidden /> Editar
                  </Link>
                  <ToggleActiveButton id={c.slug} active={c.is_active} action={toggleCategory} />
                  {!inUse && <ConfirmDeleteButton id={c.slug} label={c.name} action={deleteCategory} />}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
