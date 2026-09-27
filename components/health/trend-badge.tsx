import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { TrendDirection } from "@/types/health";
import { cn } from "@/lib/utils";

export function TrendBadge({
  direction,
  changePct,
  positiveIsGood = true,
  className,
}: {
  direction: TrendDirection;
  changePct?: number;
  positiveIsGood?: boolean;
  className?: string;
}) {
  if (direction === "flat" || changePct === undefined) {
    return (
      <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground", className)}>
        <Minus className="h-3 w-3" />
        Flat
      </span>
    );
  }

  const isGood = direction === "up" ? positiveIsGood : !positiveIsGood;
  const Icon = direction === "up" ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        isGood ? "text-accent" : "text-warn",
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(changePct).toFixed(1)}%
    </span>
  );
}
