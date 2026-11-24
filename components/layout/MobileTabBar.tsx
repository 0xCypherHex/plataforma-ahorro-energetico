"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActivePath } from "./nav-items";

/** Barra de pestañas fija abajo, solo en móvil (oculta desde md). */
export function MobileTabBar() {
  const pathname = usePathname();
  const tabs = NAV_ITEMS.filter((item) => item.mobileTab);

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {tabs.map(({ href, shortLabel, Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium ${
                  active ? "text-emerald-700" : "text-slate-500"
                }`}
              >
                <span className={`rounded-full px-3 py-1 ${active ? "bg-emerald-100" : ""}`}>
                  <Icon className="size-5" aria-hidden />
                </span>
                {shortLabel}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
