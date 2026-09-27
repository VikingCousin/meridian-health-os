import { SystemStatus } from "@/types/health";
import { cn } from "@/lib/utils";

const statusMeta: Record<SystemStatus, { label: string; className: string; dot: string }> = {
  good: { label: "Good", className: "bg-accent-soft text-accent", dot: "bg-accent" },
  stable: { label: "Stable", className: "bg-info-soft text-info", dot: "bg-info" },
  improving: { label: "Improving", className: "bg-gold-soft text-gold", dot: "bg-gold" },
  attention: { label: "Worth a look", className: "bg-warn-soft text-warn", dot: "bg-warn" },
  needs_data: { label: "More data needed", className: "bg-surface-muted text-muted-foreground", dot: "bg-muted-foreground" },
  has_data: { label: "Data logged", className: "bg-info-soft text-info", dot: "bg-info" },
};

export function StatusPill({ status, className }: { status: SystemStatus; className?: string }) {
  const meta = statusMeta[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium", meta.className, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

export { statusMeta };
