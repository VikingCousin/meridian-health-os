import Link from "next/link";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { TechnicalPanel } from "@/components/ui/technical-panel";
import { ConfidenceBadge } from "@/components/health/confidence-badge";
import { Badge } from "@/components/ui/badge";
import type { InsightSummaryCard as InsightSummaryCardData } from "@/types/health";

const sourceLabels: Record<string, string> = {
  wearable: "Wearable",
  lab: "Lab",
  journal: "Journal",
  manual: "Manual",
  ai_extracted: "AI extracted",
  calculated: "Calculated",
  imported_pdf: "Imported PDF",
};

/**
 * The Insights-page card. Deliberately analytical in tone (evidence counts,
 * confidence, sources) rather than social-media-style — see Phase 4 spec.
 */
export function InsightSummaryCard({ insight }: { insight: InsightSummaryCardData }) {
  return (
    <TechnicalPanel className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-mono text-[13px] font-semibold uppercase tracking-wide text-foreground">{insight.title}</h3>
        <ConfidenceBadge level={insight.confidence} />
      </div>
      <p className="text-[13px] leading-relaxed text-muted-foreground">{insight.summary}</p>

      {(insight.supportingCount !== undefined || insight.contradictingCount !== undefined) && (
        <div className="flex items-center gap-3 text-[12px]">
          {insight.supportingCount !== undefined && (
            <span className="inline-flex items-center gap-1 text-state-good">
              <CheckCircle2 className="h-3.5 w-3.5" /> {insight.supportingCount} supporting
            </span>
          )}
          {insight.contradictingCount !== undefined && insight.contradictingCount > 0 && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <XCircle className="h-3.5 w-3.5" /> {insight.contradictingCount} contradicting
            </span>
          )}
        </div>
      )}

      <div className="mt-1 flex items-center justify-between gap-2 border-t border-border-soft pt-3">
        <div className="flex items-center gap-1.5">
          {insight.sourceTypes.map((s) => (
            <Badge key={s} variant="neutral">
              {sourceLabels[s] ?? s}
            </Badge>
          ))}
        </div>
        <Link href={`/insights/${insight.id}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">
          Explore <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </TechnicalPanel>
  );
}
