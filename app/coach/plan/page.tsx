import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { PriorityCard } from "@/components/coach/priority-card";
import { computeWeeklyPriorities } from "@/lib/coach/coach-orchestrator.service";
import { listActivePriorities } from "@/lib/services/coach-priority.service";

export default async function CoachPlanPage() {
  const accepted = await listActivePriorities();

  // If nothing's been accepted yet, show a live, purely deterministic
  // suggestion (no LLM call) so this page is useful from the very first visit.
  const suggested = accepted.length === 0 ? await computeWeeklyPriorities() : [];

  return (
    <PageContainer className="animate-fade-in-up">
      <div>
        <Link href="/coach" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Coach
        </Link>
      </div>
      <PageHeader eyebrow="This week" title="Your plan" description="A small, deterministic set of priorities — not a rigid prescription." />

      {accepted.length > 0 ? (
        <div className="flex flex-col gap-3">
          {accepted.map((p) => (
            <PriorityCard
              key={p.id}
              persistedId={p.id}
              priority={{
                interventionId: p.interventionId,
                title: p.title,
                tier: p.tier,
                score: p.score,
                why: p.reason,
                linkedGoalIds: p.linkedGoalIds,
                linkedInsightIds: p.linkedInsightIds,
                linkedMetricKeys: p.linkedMetricKeys,
                confidence: p.confidence,
                burden: p.burden,
                cautions: [],
                requiresMedicalReview: p.requiresMedicalReview,
              }}
            />
          ))}
        </div>
      ) : suggested.length > 0 ? (
        <div className="flex flex-col gap-3">
          {suggested.map((p) => (
            <PriorityCard key={p.interventionId} priority={p} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No clear focus yet — add an active goal, or run &ldquo;Analyze my health data&rdquo; from Insights so the Coach has personal patterns to work from.
        </div>
      )}
    </PageContainer>
  );
}
