"use client";

import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ReferenceDot,
  CartesianGrid,
} from "recharts";
import { TrendPoint, MetricRange } from "@/types/health";

function ChartTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: { payload: TrendPoint }[];
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-xs shadow-lg">
      <div className="font-mono font-medium tabular-nums text-foreground">
        {point.value}
        {unit ? ` ${unit}` : ""}
      </div>
      <div className="text-muted-foreground">{point.label}</div>
    </div>
  );
}

/** Instrument-style trend chart: dark technical grid, a shaded target-range band, a crosshair cursor, and a highlighted most-recent value. */
export function TrendChart({
  data,
  unit,
  color = "var(--accent)",
  ranges,
  height = 180,
  showYAxis = true,
}: {
  data: TrendPoint[];
  unit?: string;
  color?: string;
  ranges?: MetricRange[];
  height?: number;
  showYAxis?: boolean;
}) {
  const gradientId = `grad-${color.replace(/[^a-zA-Z0-9]/g, "")}`;
  const target = ranges?.find((r) => r.kind === "personal_target");
  const lastPoint = data[data.length - 1];
  const hasBand = target?.min !== undefined && target?.max !== undefined;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: showYAxis ? 0 : 8, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            axisLine={{ stroke: "var(--border-soft)" }}
            tickLine={false}
            tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
            dy={6}
          />
          <YAxis
            hide={!showYAxis}
            width={40}
            domain={["dataMin - 2", "dataMax + 2"]}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
          />
          {hasBand ? (
            <ReferenceArea y1={target!.min} y2={target!.max} fill="var(--state-good)" fillOpacity={0.06} stroke="none" />
          ) : (
            <>
              {target?.max !== undefined && (
                <ReferenceLine y={target.max} stroke="var(--gold)" strokeDasharray="4 4" strokeWidth={1} />
              )}
              {target?.min !== undefined && (
                <ReferenceLine y={target.min} stroke="var(--gold)" strokeDasharray="4 4" strokeWidth={1} />
              )}
            </>
          )}
          {hasBand && (
            <>
              <ReferenceLine y={target!.min} stroke="var(--state-good)" strokeDasharray="4 4" strokeWidth={1} strokeOpacity={0.6} />
              <ReferenceLine y={target!.max} stroke="var(--state-good)" strokeDasharray="4 4" strokeWidth={1} strokeOpacity={0.6} />
            </>
          )}
          <Tooltip
            content={<ChartTooltip unit={unit} />}
            cursor={{ stroke: "var(--accent)", strokeWidth: 1, strokeDasharray: "3 3" }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={{ r: 2.5, fill: color, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: color, strokeWidth: 2, stroke: "var(--surface-elevated)" }}
          />
          {lastPoint && (
            <ReferenceDot
              x={lastPoint.label}
              y={lastPoint.value}
              r={4.5}
              fill={color}
              stroke="var(--surface-elevated)"
              strokeWidth={2}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Sparkline({
  data,
  color = "var(--accent)",
  height = 40,
}: {
  data: TrendPoint[];
  color?: string;
  height?: number;
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`spark-${color.replace(/[^a-zA-Z0-9]/g, "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#spark-${color.replace(/[^a-zA-Z0-9]/g, "")})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
