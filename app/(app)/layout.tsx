import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { requireProfile } from "@/lib/auth";

// Next 16 + Cache Components: este segmento lee la sesión (cookies) en cada petición,
// así que se marca como "bloqueante" en lugar de prerenderizarse en el shell estático.
export const instant = false;

// Todas las páginas dentro de (app) requieren sesión.
export default async function PrivateLayout({ children }: { children: ReactNode }) {
  const profile = await requireProfile();
  return <AppShell profile={profile}>{children}</AppShell>;
}
