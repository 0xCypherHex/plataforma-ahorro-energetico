import Link from "next/link";
import { Zap } from "lucide-react";

export function Logo({
  href = "/",
  compact = false,
  hideTextOnMobile = false,
}: {
  href?: string;
  compact?: boolean;
  /** Oculta el nombre en pantallas pequeñas (deja solo el ícono) */
  hideTextOnMobile?: boolean;
}) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-semibold text-slate-900">
      <span className="grid size-9 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm">
        <Zap className="size-5" aria-hidden />
      </span>
      {!compact && (
        <span className={`whitespace-nowrap leading-tight ${hideTextOnMobile ? "hidden sm:block" : ""}`}>
          Ahorro Energético
          <span className="block text-xs font-medium text-emerald-700">Comunitario · ODS 7</span>
        </span>
      )}
    </Link>
  );
}
