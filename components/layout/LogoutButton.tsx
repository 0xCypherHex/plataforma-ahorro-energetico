import { LogOut } from "lucide-react";
import { logout } from "@/app/(auth)/actions";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action={logout}>
      <button
        type="submit"
        title="Cerrar sesión"
        className={`inline-flex items-center gap-2 rounded-xl text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-700 ${
          compact ? "p-2" : "w-full px-3 py-2.5"
        }`}
      >
        <LogOut className="size-5" aria-hidden />
        <span className={compact ? "sr-only" : ""}>Cerrar sesión</span>
      </button>
    </form>
  );
}
