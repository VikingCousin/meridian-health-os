import { cn } from "@/lib/utils";

/**
 * A single segment in a radial/segmented metric panel (e.g. a CBC
 * differential). Shows where a value sits within its lab reference range as
 * a ring — never a diagnostic percentage, just "where in the normal band."
 * Renders an explicit "No data" state rather than inventing a value.
 */
export function RadialMetric({
  label,
  shortLabel,
  value,
  unit,
  referenceMin,
  referenceMax,
  color = "var(--accent)",
  size = 96,
}: {
  label: string;
  shortLabel?: string;
  value?: number;
  unit?: string;
  referenceMin?: number;
  referenceMax?: number;
  color?: string;
  size?: number;
}) {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const hasData = value !== undefined;
  const hasRange = referenceMin !== undefined && referenceMax !== undefined;

  let fraction = 0;
  let withinRange = true;
  if (hasData && hasRange) {
    fraction = Math.min(1, Math.max(0, (value - referenceMin!) / (referenceMax! - referenceMin!)));
    withinRange = value >= referenceMin! && value <= referenceMax!;
  } else if (hasData) {
    fraction = 1;
  }

  const offset = circumference - fraction * circumference;

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border-soft)" strokeWidth={stroke} />
          {hasData && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={withinRange ? color : "var(--state-elevated)"}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-[stroke-dashoffset] duration-700 ease-out"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {hasData ? (
            <>
              <span className="font-mono text-base font-semibold tabular-nums text-foreground">{value}</span>
              {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
            </>
          ) : (
            <span className="text-[11px] font-medium text-text-muted">No data</span>
          )}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-foreground">{shortLabel ?? label}</p>
        {hasData && hasRange && (
          <p className={cn("text-[10px]", withinRange ? "text-muted-foreground" : "text-state-elevated")}>
            {referenceMin}–{referenceMax} {unit}
          </p>
        )}
      </div>
    </div>
  );
}
