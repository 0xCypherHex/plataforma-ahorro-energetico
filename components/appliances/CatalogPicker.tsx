"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { inputClassName } from "@/components/ui/Field";
import { formatNumber } from "@/lib/format";
import type { ApplianceCatalogItem, Category } from "@/types/database";

interface Props {
  catalog: ApplianceCatalogItem[];
  categories: Category[];
  selectedId: string | null;
  onSelect: (item: ApplianceCatalogItem) => void;
}

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Buscador del catálogo predefinido con filtro por categoría. */
export function CatalogPicker({ catalog, categories, selectedId, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("");

  const results = useMemo(() => {
    const q = normalize(query.trim());
    return catalog.filter(
      (item) => (!category || item.category_slug === category) && (!q || normalize(item.name).includes(q)),
    );
  }, [catalog, query, category]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar: refrigerador, foco, TV…"
          aria-label="Buscar en el catálogo"
          className={`${inputClassName} pl-9`}
        />
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {[{ slug: "", name: "Todas", icon: null } as Pick<Category, "slug" | "name" | "icon">, ...categories].map((c) => {
          const active = c.slug === category;
          return (
            <button
              key={c.slug || "todas"}
              type="button"
              onClick={() => setCategory(c.slug)}
              aria-pressed={active}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-emerald-400"
              }`}
            >
              {c.icon ? `${c.icon} ` : ""}
              {c.name}
            </button>
          );
        })}
      </div>

      <ul className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-1.5" aria-label="Resultados del catálogo">
        {results.length === 0 && <li className="p-3 text-sm text-slate-500">Sin resultados. Prueba con “Manual”.</li>}
        {results.map((item) => {
          const selected = item.id === selectedId;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item)}
                aria-pressed={selected}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                  selected ? "bg-emerald-50 ring-1 ring-emerald-500" : "hover:bg-slate-50"
                }`}
              >
                <span className="text-lg" aria-hidden>
                  {categories.find((c) => c.slug === item.category_slug)?.icon ?? "🔌"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{item.name}</span>
                  <span className="block text-xs text-slate-500">
                    ≈ {formatNumber(item.default_watts)} W · {formatNumber(item.default_hours_per_day)} h/día ·{" "}
                    {item.default_days_per_week} días/sem
                  </span>
                </span>
                {selected && <Check className="size-5 text-emerald-600" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
