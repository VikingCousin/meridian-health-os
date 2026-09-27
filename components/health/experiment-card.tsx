import { Experiment } from "@/types/health";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FlaskConical } from "lucide-react";

const statusMeta: Record<Experiment["status"], { label: string; variant: "accent" | "info" | "neutral" }> = {
  active: { label: "Active", variant: "accent" },
  completed: { label: "Completed", variant: "neutral" },
  planned: { label: "Planned", variant: "info" },
  abandoned: { label: "Abandoned", variant: "neutral" },
};

export function ExperimentCard({ experiment }: { experiment: Experiment }) {
  const status = statusMeta[experiment.status];
  const progressPct = experiment.durationDays
    ? Math.round((experiment.currentDay / experiment.durationDays) * 100)
    : 0;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-soft text-gold">
              <FlaskConical className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div>
              <h4 className="font-medium leading-snug">{experiment.title}</h4>
              <p className="mt-1 text-sm text-muted-foreground">{experiment.hypothesis}</p>
            </div>
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>

        {experiment.status !== "planned" && (
          <div className="flex flex-col gap-1.5">
            <Progress value={progressPct} indicatorClassName="bg-gold" />
            <span className="text-xs text-muted-foreground">
              Day {experiment.currentDay} / {experiment.durationDays}
            </span>
          </div>
        )}

        {experiment.snapshots.length > 0 && (
          <div className="grid grid-cols-2 gap-3 border-t border-border-soft pt-3 sm:grid-cols-3">
            {experiment.snapshots.map((s) => (
              <div key={s.metric} className="flex flex-col">
                <span className="text-[11px] text-muted-foreground">{s.metric}</span>
                <span className="text-sm font-medium">
                  {s.baseline}
                  <span className="mx-1 text-muted-foreground">→</span>
                  {s.current} {s.unit}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {experiment.trackedMetrics.map((m) => (
            <Badge key={m} variant="outline">
              {m}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
