import { ConfidenceLevel } from "@/types/health";
import { cn } from "@/lib/utils";

const confidenceMeta: Record<ConfidenceLevel, { label: string; dots: number; className: string }> = {
  early_observation: { label: "Early observation", dots: 1, className: "text-muted-foreground" },
  possible_pattern: { label: "Possible pattern", dots: 2, className: "text-info" },
  moderate_evidence: { label: "Moderate evidence", dots: 3, className: "text-gold" },
  strong_pattern: { label: "Strong personal pattern", dots: 4, className: "text-accent" },
};

export function ConfidenceBadge({ level, className }: { level: ConfidenceLevel; className?: string }) {
  const meta = confidenceMeta[level];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium", meta.className, className)}>
      <span className="flex items-center gap-0.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              i < meta.dots ? "bg-current" : "bg-current/20"
            )}
          />
        ))}
      </span>
      {meta.label}
    </span>
  );
}
