import type { ReactNode } from "react";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AppShell } from "@/components/layout/AppShell";
import { requireAdmin } from "@/lib/auth";

// Next 16 + Cache Components: este segmento lee la sesión (cookies) en cada petición,
// así que se marca como "bloqueante" en lugar de prerenderizarse en el shell estático.
export const instant = false;

// Segunda barrera (la primera es proxy.ts): si no es admin, redirige al panel.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const profile = await requireAdmin();
  return (
    <AppShell profile={profile}>
      <AdminTabs />
      {children}
    </AppShell>
  );
}
