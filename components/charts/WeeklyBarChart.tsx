"use client";

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { ChartPlaceholder } from "./ChartPlaceholder";
import { ChartTooltip } from "./ChartTooltip";
import { useIsClient } from "./useIsClient";
import { AXIS_TICK, CHART_COLORS } from "./theme";

export interface WeeklyDatum {
  /** Lunes de la semana 'YYYY-MM-DD' */
  weekStart: string;
  value: number;
  details: string[];
}

/** Barras verticales por semana (una sola serie), p. ej. kWh ahorrados. */
export function WeeklyBarChart({
  data,
  ariaLabel,
  unitLabel,
  color = CHART_COLORS.primary,
}: {
  data: WeeklyDatum[];
  ariaLabel: string;
  /** Unidad del eje y del tooltip, p. ej. "kWh" (texto: las funciones no pueden venir del servidor) */
  unitLabel: string;
  color?: string;
}) {
  const isClient = useIsClient();
  if (!isClient) return <ChartPlaceholder height={220} />;

  return (
    <div role="img" aria-label={ariaLabel}>
      <BarChart responsive style={{ width: "100%", height: 220 }} data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="20%">
        <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
        <XAxis
          dataKey="weekStart"
          tickLine={false}
          axisLine={{ stroke: CHART_COLORS.grid }}
          tick={AXIS_TICK}
          tickFormatter={(d: string) => formatDate(d, { day: "numeric", month: "short" })}
          minTickGap={12}
        />
        <YAxis
          width={52}
          tickLine={false}
          axisLine={false}
          tick={AXIS_TICK}
          allowDecimals={false}
          label={{ value: unitLabel, angle: -90, position: "insideLeft", fill: CHART_COLORS.axis, fontSize: 12 }}
        />
        <Tooltip
          cursor={{ fill: "#f1f5f9" }}
          content={(props) => (
            <ChartTooltip<WeeklyDatum>
              active={props.active}
              payload={props.payload}
              label={props.label}
              title={(d) => `Semana del ${formatDate(d.weekStart, { day: "numeric", month: "long" })}`}
              lines={(d) => [`${formatNumber(d.value)} ${unitLabel}`, ...d.details]}
            />
          )}
        />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />
      </BarChart>
    </div>
  );
}
