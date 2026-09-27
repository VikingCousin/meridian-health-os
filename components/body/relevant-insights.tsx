import Link from "next/link";
import { ArrowRight, Radar } from "lucide-react";
import { TechnicalPanel } from "@/components/ui/technical-panel";
import { ConfidenceBadge } from "@/components/health/confidence-badge";
import { listInsightsForSystem } from "@/lib/services/insight.service";
import type { BodySystemId } from "@/types/health";

/**
 * A deliberately small, bounded slice of the pattern engine's output for
 * this system — max 3 items, so the anatomical interface doesn't turn into
 * a second insights feed. Full detail lives at /insights/[id].
 */
export async function RelevantInsights({ system }: { system: BodySystemId }) {
  const insights = await listInsightsForSystem(system, 3);
  if (insights.length === 0) return null;

  return (
    <TechnicalPanel eyebrow={<span className="flex items-center gap-1.5"><Radar className="h-3 w-3" /> Relevant insights</span>}>
      <div className="flex flex-col divide-y divide-border-soft">
        {insights.map((insight) => (
          <Link
            key={insight.id}
            href={insight.exploreHref ?? `/insights/${insight.id}`}
            className="group flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-elevated"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{insight.title}</p>
              <ConfidenceBadge level={insight.confidence} className="mt-1" />
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </TechnicalPanel>
  );
}
