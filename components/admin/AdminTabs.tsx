"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const ADMIN_SECTIONS = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/retos", label: "Retos" },
  { href: "/admin/catalogo", label: "Catálogo" },
  { href: "/admin/categorias", label: "Categorías" },
  { href: "/admin/usuarios", label: "Usuarios" },
] as const;

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones de administración" className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-2 rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200 sm:w-auto">
        {ADMIN_SECTIONS.map(({ href, label }) => {
          const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`block whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition ${
                  active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
