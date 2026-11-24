import type { ReactNode } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import type { CurrentProfile } from "@/lib/auth";
import { ACCOUNT_TYPE_LABELS } from "@/lib/format";
import { LogoutButton } from "./LogoutButton";
import { MobileTabBar } from "./MobileTabBar";
import { SidebarNav } from "./SidebarNav";

function initials(name: string, email: string) {
  const source = name.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function Avatar({ profile, size = "md" }: { profile: CurrentProfile; size?: "sm" | "md" }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-amber-100 font-semibold text-amber-800 ${
        size === "sm" ? "size-9 text-sm" : "size-10"
      }`}
      aria-hidden
    >
      {initials(profile.full_name, profile.email)}
    </span>
  );
}

/**
 * Estructura de la app autenticada.
 *  · Móvil (<768px): encabezado arriba + barra de pestañas abajo.
 *  · Tablet/escritorio (≥768px): barra lateral fija a la izquierda.
 */
export function AppShell({ profile, children }: { profile: CurrentProfile; children: ReactNode }) {
  const isAdmin = profile.role === "admin";
  const displayName = profile.full_name || profile.email;

  return (
    <div className="min-h-dvh bg-slate-50">
      {/* Barra lateral (md+) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white px-4 py-5 md:flex">
        <Logo href="/dashboard" />
        <div className="mt-8 flex-1 overflow-y-auto">
          <SidebarNav isAdmin={isAdmin} />
        </div>
        <div className="mt-4 border-t border-slate-200 pt-4">
          <Link href="/perfil" className="flex items-center gap-3 rounded-xl p-2 hover:bg-slate-50">
            <Avatar profile={profile} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-900">{displayName}</span>
              <span className="block truncate text-xs text-slate-500">
                {ACCOUNT_TYPE_LABELS[profile.account_type]}
                {profile.community ? ` · ${profile.community.name}` : ""}
              </span>
            </span>
          </Link>
          <div className="mt-2">
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* Encabezado (móvil) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <Logo href="/dashboard" compact />
        <div className="flex items-center gap-1">
          {isAdmin && (
            <Link href="/admin" className="rounded-xl p-2 text-slate-600 hover:bg-emerald-50" title="Administración">
              <ShieldCheck className="size-5" aria-hidden />
              <span className="sr-only">Administración</span>
            </Link>
          )}
          <LogoutButton compact />
          <Link href="/perfil" title="Mi perfil" className="ml-1">
            <Avatar profile={profile} size="sm" />
            <span className="sr-only">Mi perfil</span>
          </Link>
        </div>
      </header>

      {/* Contenido */}
      <main className="px-4 pb-28 pt-5 sm:px-6 md:ml-64 md:px-8 md:pb-10 md:pt-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>

      <MobileTabBar />
    </div>
  );
}
