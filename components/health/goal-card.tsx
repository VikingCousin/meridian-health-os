import Link from "next/link";
import { Goal } from "@/types/health";
import type { FocusItem } from "@/lib/coach/types";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { format, parseISO } from "date-fns";

const statusMeta: Record<Goal["status"], { label: string; variant: "accent" | "warn" | "info" | "neutral" }> = {
  on_track: { label: "On track", variant: "accent" },
  attention: { label: "Needs attention", variant: "warn" },
  preparation: { label: "Preparation", variant: "info" },
  completed: { label: "Completed", variant: "neutral" },
  abandoned: { label: "Abandoned", variant: "neutral" },
};

const horizonLabel: Record<NonNullable<Goal["timeHorizon"]>, string> = {
  long_term: "Long-term",
  quarter: "This quarter",
  month: "This month",
  temporary: "Temporary",
};

export function GoalCard({ goal, focusItems = [] }: { goal: Goal; focusItems?: FocusItem[] }) {
  const status = statusMeta[goal.status];
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
              {goal.kind === "long_term" ? "Long-term goal" : goal.kind === "project" ? "Project" : "Supporting goal"}
              {goal.timeHorizon && <span className="text-muted-foreground/60">· {horizonLabel[goal.timeHorizon]}</span>}
            </p>
            <h4 className="mt-0.5 font-medium">{goal.title}</h4>
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{goal.description}</p>
        {goal.rationale && goal.rationale !== goal.description && (
          <p className="text-[13px] italic text-muted-foreground">{goal.rationale}</p>
        )}
        {goal.progress !== undefined && (
          <div className="flex flex-col gap-1.5">
            <Progress value={goal.progress} />
            <span className="text-xs text-muted-foreground">{goal.progress}% toward this goal</span>
          </div>
        )}
        {goal.targetDate && (
          <p className="text-xs text-muted-foreground">
            Target date: {format(parseISO(goal.targetDate), "d MMM yyyy")}
          </p>
        )}
        {focusItems.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-border-soft pt-2.5">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-accent">
              <Sparkles className="h-3 w-3" /> Coach focus
            </p>
            {focusItems.map((item) => (
              <Link key={item.interventionId} href="/coach/plan" className="text-[13px] text-foreground hover:underline">
                {item.title}
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
