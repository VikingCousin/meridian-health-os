import Link from "next/link";
import { AlertTriangle, ArrowRight, FlaskConical } from "lucide-react";
import { TechnicalPanel } from "@/components/ui/technical-panel";
import { Button } from "@/components/ui/button";
import { PriorityCard } from "@/components/coach/priority-card";
import { NewExperimentDialog } from "@/components/health/new-experiment-dialog";
import { useTranslations } from "@/lib/i18n/locale-provider";
import type { CoachResponse } from "@/lib/coach/types";

const evidenceKindLabel: Record<string, string> = {
  your_data: "Your data",
  personal_pattern: "Personal pattern",
  general_knowledge: "General knowledge",
  experimental_idea: "Experimental idea",
  medical_followup: "Medical follow-up",
};

export function CoachTurn({ question, response }: { question: string; response: CoachResponse }) {
  const { t } = useTranslations();
  const isSafetyGated = response.safety.classification === "URGENT_MEDICAL_ATTENTION";

  return (
    <div className="flex flex-col gap-4">
      <div className="self-end rounded-xl bg-surface-elevated px-4 py-2.5 text-[13px] text-foreground">{question}</div>

      {response.safety.classification !== "GENERAL_WELLNESS" && response.safety.classification !== "PERSONAL_HEALTH_CONTEXT" && (
        <div className="flex items-start gap-2 rounded-xl border border-state-watch-soft bg-state-watch-soft/40 px-4 py-3 text-[13px] text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-state-watch" />
          <p>{response.safety.message}</p>
        </div>
      )}

      {!isSafetyGated && (
        <TechnicalPanel eyebrow="What I see" className="p-4">
          <p className="text-sm text-foreground">{response.summary}</p>
          {response.observations.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-[13px] text-muted-foreground">
              {response.observations.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          )}
          {!response.aiGenerated && <p className="mt-2 text-[11px] text-muted-foreground">{t("coach.deterministicSummary")}</p>}
        </TechnicalPanel>
      )}

      {response.priorities.length > 0 && (
        <section>
          <h3 className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Top priorities</h3>
          <div className="flex flex-col gap-3">
            {response.priorities.map((p) => (
              <PriorityCard key={p.interventionId} priority={p} />
            ))}
          </div>
        </section>
      )}

      {response.evidence.length > 0 && (
        <TechnicalPanel eyebrow="Why these — data used" className="p-4">
          <div className="flex flex-col gap-2">
            {response.evidence.map((e, i) => (
              <div key={i} className="flex items-start justify-between gap-3 text-[13px]">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {evidenceKindLabel[e.kind] ?? e.kind}
                  </span>
                  <span className="text-foreground">{e.text}</span>
                </div>
                {e.href && (
                  <Link href={e.href} className="inline-flex shrink-0 items-center gap-1 text-accent hover:underline">
                    View <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </TechnicalPanel>
      )}

      {response.uncertainties.length > 0 && (
        <TechnicalPanel eyebrow="Uncertainty" className="p-4">
          <ul className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
            {response.uncertainties.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </TechnicalPanel>
      )}

      {(response.suggestedExperiment || response.suggestedFollowUpQuestions.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border-soft pt-3">
          {response.suggestedExperiment && (
            <NewExperimentDialog
              defaultValues={{ title: `Test: ${response.suggestedExperiment.title}`, durationDays: 14 }}
              trigger={
                <Button size="sm" variant="outline">
                  <FlaskConical className="h-3.5 w-3.5" /> Test this instead of assuming
                </Button>
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
