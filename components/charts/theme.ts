// Estilo común de las gráficas (Recharts). Un solo color por gráfica, ejes y rejilla discretos.
export const CHART_COLORS = {
  /** Ahorro y consumo por aparato/categoría: verde de la marca */
  primary: "#059669",
  /** Evolución del consumo estimado */
  consumption: "#2a78d6",
  grid: "#e2e8f0",
  axis: "#64748b",
  surface: "#ffffff",
} as const;

export const AXIS_TICK = { fill: CHART_COLORS.axis, fontSize: 12 } as const;
