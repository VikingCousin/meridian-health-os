import { Watch, FlaskConical, PenLine, NotebookPen, Sparkles, Calculator, FileText } from "lucide-react";
import { DataSource } from "@/types/health";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

const sourceMeta: Record<
  DataSource["type"],
  { icon: React.ElementType; className: string }
> = {
  wearable: { icon: Watch, className: "bg-info-soft text-info" },
  lab: { icon: FlaskConical, className: "bg-accent-soft text-accent" },
  manual: { icon: PenLine, className: "bg-surface-muted text-muted-foreground" },
  journal: { icon: NotebookPen, className: "bg-sys-brain-soft text-sys-brain" },
  ai_extracted: { icon: Sparkles, className: "bg-gold-soft text-gold" },
  calculated: { icon: Calculator, className: "bg-surface-muted text-muted-foreground" },
  imported_pdf: { icon: FileText, className: "bg-gold-soft text-gold" },
};

export function SourceBadge({ source, className }: { source: DataSource; className?: string }) {
  const meta = sourceMeta[source.type];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none",
        meta.className,
        className
      )}
      title={source.subjective ? "Subjective, self-reported observation" : undefined}
    >
      <Icon className="h-3 w-3" strokeWidth={2} />
      {source.label}
      {source.date && (
        <span className="opacity-70">· {format(parseISO(source.date), "d MMM yyyy")}</span>
      )}
      {source.subjective && <span className="opacity-70">· subjective</span>}
    </span>
  );
}
