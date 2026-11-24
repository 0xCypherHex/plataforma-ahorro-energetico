import Link from "next/link";
import { primaryButtonClassName } from "@/components/ui/styles";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 px-4">
      <div className="text-center">
        <p className="text-sm font-semibold text-emerald-700">Error 404</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Esta página no existe (todavía)</h1>
        <p className="mt-2 text-slate-600">Puede que esta sección se construya en una fase posterior del proyecto.</p>
        <Link href="/dashboard" className={`${primaryButtonClassName} mt-6`}>
          Volver al panel
        </Link>
      </div>
    </main>
  );
}
