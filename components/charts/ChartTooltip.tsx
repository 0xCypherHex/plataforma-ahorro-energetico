"use client";

/**
 * Tooltip con el estilo de la app. `lines` recibe el dato completo del punto
 * (payload[0].payload) y devuelve los renglones a mostrar.
 */
export function ChartTooltip<T>({
  active,
  payload,
  label,
  title,
  lines,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
  label?: string | number;
  title?: (datum: T, label: string | number | undefined) => string;
  lines: (datum: T) => string[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0].payload as T;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold text-slate-900">{title ? title(datum, label) : String(label ?? "")}</p>
      {lines(datum).map((line) => (
        <p key={line} className="text-slate-600">
          {line}
        </p>
      ))}
    </div>
  );
}
