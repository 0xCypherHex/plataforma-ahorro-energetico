/** Espacio reservado con la misma altura que la gráfica (evita saltos de diseño). */
export function ChartPlaceholder({ height }: { height: number }) {
  return <div className="w-full animate-pulse rounded-xl bg-slate-100" style={{ height }} aria-hidden />;
}
