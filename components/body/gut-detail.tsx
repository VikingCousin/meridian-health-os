import Link from "next/link";
import { BodySystem } from "@/types/health";
import { SystemPanelHeader } from "@/components/body/system-panel-header";
import { SystemTabs } from "@/components/body/system-tabs";
import { GutIllustration } from "@/components/body/gut-illustration";
import { BiomarkerCard } from "@/components/health/biomarker-card";
import { InsightCard } from "@/components/health/insight-card";
import { TrendChart } from "@/components/charts/trend-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listBiomarkersForSystem } from "@/lib/services/biomarker.service";
import { listJournalEntries } from "@/lib/services/journal.service";
import { insights } from "@/lib/mock-data/insights";
import { getSystemColorVar } from "@/lib/colors";
import { BodyKnowledgeSection } from "@/components/body/body-knowledge-section";

export async function GutDetail({ system }: { system: BodySystem }) {
  const [biomarkers, journalEntries] = await Promise.all([
    listBiomarkersForSystem("gut"),
    listJournalEntries(),
  ]);
  const relatedInsights = insights.filter((i) => i.relatedSystem === "gut");
  const symptomMentions = journalEntries.filter((e) => e.tags.some((t) => t.category === "symptom")).length;
  const color = getSystemColorVar("gut");
  const flagshipBiomarker = biomarkers.find((b) => b.id === "microbiome_diversity") ?? biomarkers[0];

  return (
    <div className="flex flex-col gap-5">
      <SystemPanelHeader system={system} />
      <SystemTabs
        biomarkers={
          biomarkers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No stool panel data yet — upload a lab report to see gut biomarkers here.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {biomarkers.map((b) => (
                <BiomarkerCard key={b.id} biomarker={b} />
              ))}
            </div>
          )
        }
        trend={
          flagshipBiomarker ? (
            <div className="rounded-xl border border-border-soft bg-surface p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">{flagshipBiomarker.name} over time</h3>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/profile/biomarker/${flagshipBiomarker.id}`}>Full history</Link>
                </Button>
              </div>
              <TrendChart data={flagshipBiomarker.history} unit={flagshipBiomarker.unit} color={color} ranges={flagshipBiomarker.ranges} height={260} />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No trend data yet.</div>
          )
        }
        relationships={
          <>
            <div className="rounded-xl border border-border-soft bg-surface p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">Journal observations</h3>
                <Badge variant="outline">Subjective</Badge>
              </div>
              <p className="mt-2 text-[15px] text-foreground">
                Digestive symptoms were mentioned <span className="font-semibold">{symptomMentions} times</span> during the past 30 days.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Journal mentions are self-reported observations, not clinical measurements.</p>
            </div>
            {relatedInsights.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {relatedInsights.map((i) => (
                  <InsightCard key={i.id} insight={i} />
                ))}
              </div>
            )}
          </>
        }
        knowledge={
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-border-soft bg-surface-elevated p-6">
              <GutIllustration />
              <p className="mx-auto mt-2 max-w-md text-center text-xs text-muted-foreground">
                An illustrative overview of your gastrointestinal system — not an anatomically precise scan.
              </p>
            </div>
            <BodyKnowledgeSection
              bodySystem="GUT"
              fallbackSummary="Gut health markers (stool panel biomarkers, microbiome diversity, inflammatory markers) are complex and interrelated — they're best read as a trend over time alongside diet and symptom journaling, not as single values in isolation."
            />
          </div>
        }
      />
    </div>
  );
}
