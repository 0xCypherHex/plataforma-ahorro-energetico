"use client";

import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate } from "@/lib/dates";
import { formatCurrency, formatNumber } from "@/lib/format";
import { ChartPlaceholder } from "./ChartPlaceholder";
import { ChartTooltip } from "./ChartTooltip";
import { useIsClient } from "./useIsClient";
import { AXIS_TICK, CHART_COLORS } from "./theme";

export interface HistoryPoint {
  date: string;
  monthlyKwh: number;
  monthlyCost: number;
  applianceCount: number;
}

/**
 * Evolución del consumo mensual estimado (una foto por día en que cambiaron tus aparatos).
 * Se dibuja escalonada: el valor se mantiene igual hasta el siguiente cambio.
 */
export function ConsumptionHistoryChart({ data }: { data: HistoryPoint[] }) {
  const isClient = useIsClient();
  if (data.length < 2) {
    return (
      <p className="py-10 text-center text-sm text-slate-500">
        La gráfica aparecerá cuando tus aparatos cambien en al menos dos días distintos.
      </p>
    );
  }

  if (!isClient) return <ChartPlaceholder height={240} />;

  return (
    <div role="img" aria-label="Evolución del consumo mensual estimado">
      <LineChart responsive style={{ width: "100%", height: 240 }} data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={{ stroke: CHART_COLORS.grid }}
          tick={AXIS_TICK}
          tickFormatter={(d: string) => formatDate(d, { day: "numeric", month: "short" })}
          minTickGap={24}
        />
        <YAxis
          width={52}
          tickLine={false}
          axisLine={false}
          tick={AXIS_TICK}
          tickFormatter={(v: number) => formatNumber(v, 0)}
          label={{ value: "kWh/mes", angle: -90, position: "insideLeft", fill: CHART_COLORS.axis, fontSize: 12 }}
        />
        <Tooltip
          cursor={{ stroke: CHART_COLORS.axis, strokeDasharray: "3 3" }}
          content={(props) => (
            <ChartTooltip<HistoryPoint>
              active={props.active}
              payload={props.payload}
              label={props.label}
              title={(d) => formatDate(d.date)}
              lines={(d) => [
                `${formatNumber(d.monthlyKwh)} kWh al mes`,
                `${formatCurrency(d.monthlyCost)} al mes`,
                `${d.applianceCount} aparatos`,
              ]}
            />
          )}
        />
        <Line
          type="stepAfter"
          dataKey="monthlyKwh"
          stroke={CHART_COLORS.consumption}
          strokeWidth={2}
          dot={{ r: 4, fill: CHART_COLORS.consumption, stroke: CHART_COLORS.surface, strokeWidth: 2 }}
          activeDot={{ r: 6, stroke: CHART_COLORS.surface, strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </div>
  );
}
