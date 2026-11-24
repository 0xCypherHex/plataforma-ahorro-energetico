"use client";

import { Bar, BarChart, LabelList, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, CHART_COLORS } from "./theme";
import { ChartPlaceholder } from "./ChartPlaceholder";
import { ChartTooltip } from "./ChartTooltip";
import { useIsClient } from "./useIsClient";

export interface BarDatum {
  name: string;
  value: number;
  /** Texto de la etiqueta al final de la barra, p. ej. "$240.24" */
  valueLabel: string;
  /** Renglones extra del tooltip */
  details: string[];
}

const MAX_NAME_CHARS = 18;

/** Etiqueta del eje en una sola línea, recortada con "…" (el nombre completo aparece al pasar el cursor). */
function NameTick({ x, y, payload }: { x?: number | string; y?: number | string; payload?: { value?: unknown } }) {
  const full = String(payload?.value ?? "");
  const short = full.length > MAX_NAME_CHARS ? `${full.slice(0, MAX_NAME_CHARS - 1)}…` : full;
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill={AXIS_TICK.fill} fontSize={AXIS_TICK.fontSize}>
      <title>{full}</title>
      {short}
    </text>
  );
}

/** Barras horizontales ordenadas (una sola serie). Altura según el número de filas. */
export function HorizontalBarChart({
  data,
  ariaLabel,
  color = CHART_COLORS.primary,
}: {
  data: BarDatum[];
  ariaLabel: string;
  color?: string;
}) {
  const height = Math.max(120, data.length * 40 + 24);
  const isClient = useIsClient();
  if (!isClient) return <ChartPlaceholder height={height} />;

  return (
    <div role="img" aria-label={ariaLabel}>
      <BarChart
        responsive
        style={{ width: "100%", height }}
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 96, bottom: 4, left: 0 }}
        barCategoryGap={8}
      >
        <XAxis type="number" hide domain={[0, "dataMax"]} />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          tickLine={false}
          axisLine={false}
          tick={NameTick}
        />
        <Tooltip
          cursor={{ fill: "#f1f5f9" }}
          content={(props) => (
            <ChartTooltip<BarDatum> active={props.active}
              payload={props.payload}
              label={props.label} title={(d) => d.name} lines={(d) => [d.valueLabel, ...d.details]} />
          )}
        />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
          <LabelList dataKey="valueLabel" position="right" fill="#334155" fontSize={12} style={{ whiteSpace: "nowrap" }} width={90} />
        </Bar>
      </BarChart>
    </div>
  );
}
