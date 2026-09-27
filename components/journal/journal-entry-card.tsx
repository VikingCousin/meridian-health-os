import { JournalEntry } from "@/types/health";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { format, parseISO } from "date-fns";

const tagVariant: Record<JournalEntry["tags"][number]["category"], "accent" | "info" | "warn" | "gold" | "neutral"> = {
  nutrition: "gold",
  sleep: "info",
  training: "accent",
  mood: "warn",
  symptom: "warn",
  other: "neutral",
};

export function JournalEntryCard({ entry }: { entry: JournalEntry }) {
  return (
    <div className="rounded-2xl border border-border-soft bg-surface p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          {format(parseISO(entry.date), "EEEE, d MMMM yyyy")}
        </p>
      </div>

      <p className="mt-3 text-[15px] leading-relaxed text-foreground">{entry.text}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {entry.tags.map((tag) => (
          <Badge key={tag.label} variant={tagVariant[tag.category]}>
            {tag.label}
          </Badge>
        ))}
      </div>

      {entry.aiObservations.length > 0 && (
        <div className="mt-4 rounded-xl bg-sys-brain-soft/60 p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-sys-brain">
            <Sparkles className="h-3.5 w-3.5" />
            AI noticed
          </div>
          <ul className="mt-2 flex flex-col gap-1">
            {entry.aiObservations.map((obs) => (
              <li key={obs} className="flex items-start gap-2 text-[13px] text-foreground/80">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sys-brain/50" />
                {obs}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
