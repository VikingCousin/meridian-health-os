import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SourceBadge } from "@/components/health/source-badge";
import { TrendBadge } from "@/components/health/trend-badge";
import { TrendChart } from "@/components/charts/trend-chart";
import { getBiomarkerDetail } from "@/lib/services/biomarker.service";
import { getSystemColorVar } from "@/lib/colors";
import { fromUiBodySystem } from "@/lib/services/enum-maps";
import { searchKnowledge } from "@/lib/knowledge/search.service";
import { format, parseISO } from "date-fns";

const SOURCE_LABEL: Record<string, string> = {
  CURATED: "Curated",
  USER_NOTES: "Your notes",
  NOTEBOOKLM_EXPORT: "Imported export",
  GUIDELINE: "Guideline",
  RESEARCH_SUMMARY: "Research summary",
  OTHER: "Other source",
};

export default async function BiomarkerDetailPage(props: PageProps<"/profile/biomarker/[id]">) {
  const { id } = await props.params;
  const biomarker = await getBiomarkerDetail(id);
  if (!biomarker) notFound();

  const color = getSystemColorVar(biomarker.category);
  const target = biomarker.ranges.find((r) => r.kind === "personal_target");
  const reference = biomarker.ranges.find((r) => r.kind === "lab_reference");
  const knowledgeResults = await searchKnowledge({
    text: biomarker.name,
    bodySystem: fromUiBodySystem(biomarker.category),
    limit: 3,
  });

  return (
    <PageContainer className="animate-fade-in-up max-w-3xl">
      <Link href={`/body/${biomarker.category}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-medium uppercase tracking-wide text-accent">{biomarker.shortName}</p>
          <h1 className="mt-1 text-[24px] font-bold tracking-tight sm:text-[28px]">{biomarker.name}</h1>
        </div>
        <SourceBadge source={biomarker.source} />
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-2xl border border-border-soft bg-surface p-6 sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Current</p>
          <p className="mt-1 text-2xl font-medium tabular-nums">
            {biomarker.currentValue} <span className="text-sm text-muted-foreground">{biomarker.unit}</span>
          </p>
        </div>
        {biomarker.previousValue !== undefined && (
          <div>
            <p className="text-xs text-muted-foreground">Previous</p>
            <p className="mt-1 text-2xl font-medium tabular-nums">
              {biomarker.previousValue} <span className="text-sm text-muted-foreground">{biomarker.unit}</span>
            </p>
          </div>
        )}
        {biomarker.changePct !== undefined && (
          <div>
            <p className="text-xs text-muted-foreground">Change</p>
            <p className="mt-1 text-2xl font-medium">
              <TrendBadge direction={biomarker.trendDirection} changePct={biomarker.changePct} />
            </p>
          </div>
        )}
        <div>
          <p className="text-xs text-muted-foreground">Last measured</p>
          <p className="mt-1 text-sm font-medium">{format(parseISO(biomarker.lastMeasured), "d MMM yyyy")}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {target && <Badge variant="gold">Personal target: {target.display}</Badge>}
        {reference && <Badge variant="outline">Lab reference: {reference.display}</Badge>}
      </div>

      <div className="rounded-2xl border border-border-soft bg-surface p-6">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">Trend over time</h3>
        <TrendChart data={biomarker.history} unit={biomarker.unit} color={color} ranges={biomarker.ranges} height={260} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border-soft bg-surface p-5">
          <h3 className="font-medium">What is {biomarker.shortName}?</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{biomarker.description}</p>
        </div>
        <div className="rounded-2xl border border-border-soft bg-surface p-5">
          <h3 className="font-medium">Why may it matter?</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{biomarker.whyItMatters}</p>
        </div>
      </div>

      {knowledgeResults.length > 0 && (
        <div className="rounded-2xl border border-border-soft bg-surface p-5">
          <h3 className="font-medium">What can affect it</h3>
          <p className="mt-1 text-xs text-muted-foreground">General knowledge — not personal analysis of your own data.</p>
          <div className="mt-3 flex flex-col gap-3">
            {knowledgeResults.map((r) => (
              <div key={r.chunkId} className="rounded-xl border border-border-soft bg-surface-muted/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-sm font-medium text-foreground">{r.heading}</h4>
                  <span className="shrink-0 rounded-full bg-surface-elevated px-2 py-0.5 text-[11px] text-muted-foreground">
                    {SOURCE_LABEL[r.sourceType] ?? r.sourceType}
                  </span>
                </div>
                <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">{r.content}</p>
                <p className="mt-1.5 text-[11px] text-muted-foreground/70">
                  Source: {r.documentTitle}
                  {r.sourceName ? ` — ${r.sourceName}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button asChild variant="accent" className="w-fit">
        <Link href={`/coach?q=${encodeURIComponent(`Explain my ${biomarker.shortName} trend`)}`}>
          Discuss with Coach
        </Link>
      </Button>
    </PageContainer>
  );
}
