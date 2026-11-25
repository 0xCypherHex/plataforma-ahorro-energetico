import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus, Search } from "lucide-react";
import { deleteCatalogItem, toggleCatalogItem } from "@/app/admin/actions";
import { StatusBadge, ToggleActiveButton } from "@/components/admin/AdminControls";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { inputClassName } from "@/components/ui/Field";
import { primaryButtonClassName } from "@/components/ui/styles";
import { getAllCategories, getCatalog } from "@/lib/data/admin";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Admin · Catálogo" };

const OK: Record<string, string> = { creado: "Aparato agregado al catálogo.", actualizado: "Cambios guardados.", eliminado: "Aparato eliminado del catálogo." };

export default async function AdminCatalogPage(props: PageProps<"/admin/catalogo">) {
  const searchParams = await props.searchParams;
  const category = typeof searchParams.categoria === "string" ? searchParams.categoria : "";
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const [items, categories] = await Promise.all([getCatalog({ category, q }), getAllCategories()]);
  const ok = typeof searchParams.ok === "string" ? OK[searchParams.ok] : undefined;
  const catLabel = (slug: string) => {
    const c = categories.find((x) => x.slug === slug);
    return c ? `${c.icon ?? ""} ${c.name}`.trim() : slug;
  };

  return (
    <>
      <PageHeader
        title="Catálogo de aparatos"
        description="Potencias de referencia que los usuarios eligen al registrar sus aparatos."
        actions={
          <Link href="/admin/catalogo/nuevo" className={primaryButtonClassName}>
            <Plus className="size-5" aria-hidden /> Agregar aparato
          </Link>
        }
      />
      {ok && (
        <div className="mb-4">
          <Alert variant="success">{ok}</Alert>
        </div>
      )}

      <form method="get" className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input name="q" defaultValue={q} placeholder="Buscar por nombre" aria-label="Buscar" className={`${inputClassName} pl-9`} />
        </div>
        <select name="categoria" defaultValue={category} aria-label="Categoría" className={`${inputClassName} sm:w-56`}>
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
          Filtrar
        </button>
      </form>

      <Card className="p-0">
        {items.length === 0 ? (
          <p className="p-6 text-sm text-slate-600">Sin resultados.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((i) => (
              <li key={i.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{i.name}</p>
                    <StatusBadge active={i.is_active} />
                  </div>
                  <p className="text-sm text-slate-500">
                    {catLabel(i.category_slug)} · {formatNumber(i.default_watts)} W · {formatNumber(i.default_hours_per_day)} h/día ·{" "}
                    {i.default_days_per_week} días/sem
                    {i.description ? ` · ${i.description}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Link
                    href={`/admin/catalogo/${i.id}/editar`}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"
                  >
                    <Pencil className="size-4" aria-hidden /> Editar
                  </Link>
                  <ToggleActiveButton id={i.id} active={i.is_active} action={toggleCatalogItem} />
                  <ConfirmDeleteButton id={i.id} label={i.name} action={deleteCatalogItem} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="mt-2 text-xs text-slate-500">{items.length} elementos</p>
    </>
  );
}
