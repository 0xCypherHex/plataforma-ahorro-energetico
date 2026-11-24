"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { primaryButtonClassName } from "@/components/ui/styles";

export default function PrivateError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
      <TriangleAlert className="mx-auto size-10 text-red-500" aria-hidden />
      <h1 className="mt-3 text-lg font-semibold text-slate-900">Algo salió mal</h1>
      <p className="mt-1 text-sm text-slate-600">{error.message || "No pudimos cargar esta página."}</p>
      <button type="button" onClick={reset} className={`${primaryButtonClassName} mt-5`}>
        Intentar de nuevo
      </button>
    </div>
  );
}
