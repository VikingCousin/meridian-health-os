import Link from "next/link";
import { Insight } from "@/types/health";
import { Card, CardContent } from "@/components/ui/card";
import { ConfidenceBadge } from "@/components/health/confidence-badge";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const sourceLabels: Record<string, string> = {
  wearable: "Wearable",
  lab: "Lab",
  journal: "Journal",
  manual: "Manual",
  ai_extracted: "AI extracted",
  calculated: "Calculated",
  imported_pdf: "Imported PDF",
};

export function InsightCard({ insight, className }: { insight: Insight; className?: string }) {
  return (
    <Card className={cn("min-w-[280px]", className)}>
      <CardContent className="flex h-full flex-col gap-3">
        <ConfidenceBadge level={insight.confidence} />
        <div>
          <h4 className="text-sm font-medium leading-snug">{insight.title}</h4>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{insight.explanation}</p>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-muted-foreground">
            {insight.sourceTypes.map((s) => sourceLabels[s]).join(" + ")}
          </span>
          {insight.exploreHref && (
            <Link
              href={insight.exploreHref}
              className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline"
            >
              Explore <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
