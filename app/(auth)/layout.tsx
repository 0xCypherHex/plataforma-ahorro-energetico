import type { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";

// Next 16 + Cache Components: este segmento lee la sesión (cookies) en cada petición,
// así que se marca como "bloqueante" en lugar de prerenderizarse en el shell estático.
export const instant = false;

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-emerald-50 via-white to-amber-50">
      <header className="px-4 py-5 sm:px-8">
        <Logo />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-2 sm:items-center sm:pt-0">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
