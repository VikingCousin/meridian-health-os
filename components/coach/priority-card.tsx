"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ShieldAlert, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NewExperimentDialog } from "@/components/health/new-experiment-dialog";
import { acceptCoachPriorityAction, dismissCoachPriorityAction } from "@/lib/actions/coach";
import type { PriorityCardData } from "@/lib/coach/types";

const tierLabel: Record<PriorityCardData["tier"], string> = { primary: "PRIMARY", secondary: "SECONDARY", optional: "OPTIONAL" };
const tierColor: Record<PriorityCardData["tier"], string> = {
  primary: "border-accent/50 bg-accent-soft",
  secondary: "border-border-soft bg-surface",
  optional: "border-border-soft bg-surface-muted/40",
};
const confidenceVariant: Record<PriorityCardData["confidence"], "good" | "watch" | "neutral"> = { high: "good", moderate: "watch", low: "neutral" };

export function PriorityCard({ priority, persistedId }: { priority: PriorityCardData; persistedId?: string }) {
  const [status, setStatus] = useState<"suggested" | "accepted" | "dismissed">(persistedId ? "accepted" : "suggested");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const outcomes = priority.linkedMetricKeys.slice(0, 4).map((key) => ({
    label: key.replace(/_/g, " "),
    metricType: "BIOMARKER" as const,
    metricReference: key,
  }));

  return (
    <div className={`rounded-xl border p-4 ${tierColor[priority.tier]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{tierLabel[priority.tier]}</p>
          <h4 className="mt-0.5 text-sm font-semibold text-foreground">{priority.title}</h4>
        </div>
        <Badge variant={confidenceVariant[priority.confidence]}>{priority.confidence} confidence</Badge>
      </div>

      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{priority.why}</p>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span>Burden: {priority.burden.toLowerCase()}</span>
        <span>·</span>
        <span>Score: {priority.score}</span>
        {priority.requiresMedicalReview && (
          <span className="inline-flex items-center gap-1 text-state-watch">
            <ShieldAlert className="h-3 w-3" /> Medical follow-up
          </span>
        )}
      </div>

      {priority.cautions.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {priority.cautions.map((c, i) => (
            <p key={i} className="flex items-start gap-1.5 text-[12px] text-state-watch">
              <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" /> {c}
            </p>
          ))}
        </div>
      )}

      {(priority.linkedGoalIds.length > 0 || priority.linkedInsightIds.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {priority.linkedGoalIds.map((id) => (
            <Link key={id} href="/goals" className="text-[11px] font-medium text-accent hover:underline">
              View goal
            </Link>
          ))}
          {priority.linkedInsightIds.map((id) => (
            <Link key={id} href={`/insights/${id}`} className="text-[11px] font-medium text-accent hover:underline">
              View insight
            </Link>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {status === "suggested" && (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await acceptCoachPriorityAction(priority);
                setStatus("accepted");
                router.refresh();
              })
            }
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Add to this week
          </Button>
        )}
        {status === "accepted" && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-state-good">
            <CheckCircle2 className="h-3.5 w-3.5" /> Added
          </span>
        )}
        <NewExperimentDialog
          defaultValues={{
            title: `Test: ${priority.title}`,
            hypothesis: `${priority.title} may help, based on: ${priority.why} (personal confidence: ${priority.confidence}).`,
            protocol: `For 14 days, apply "${priority.title.toLowerCase()}" and keep logging your usual metrics.`,
            durationDays: 14,
            outcomes,
          }}
          trigger={
            <Button size="sm" variant="ghost">
              Test this
            </Button>
          }
        />
        {status !== "dismissed" && persistedId === undefined && (
          <Button
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                setStatus("dismissed");
              })
            }
          >
            <XCircle className="h-3.5 w-3.5" /> Dismiss
          </Button>
        )}
        {persistedId && (
          <Button
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await dismissCoachPriorityAction(persistedId);
                router.refresh();
              })
            }
          >
            <XCircle className="h-3.5 w-3.5" /> Dismiss
          </Button>
        )}
      </div>
    </div>
  );
}
