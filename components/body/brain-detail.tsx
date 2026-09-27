import Link from "next/link";
import { BodySystem } from "@/types/health";
import { SystemPanelHeader } from "@/components/body/system-panel-header";
import { SystemTabs } from "@/components/body/system-tabs";
import { BiomarkerCard } from "@/components/health/biomarker-card";
import { InsightCard } from "@/components/health/insight-card";
import { SourceBadge } from "@/components/health/source-badge";
import { TrendChart } from "@/components/charts/trend-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listBiomarkersForSystem } from "@/lib/services/biomarker.service";
import { insights } from "@/lib/mock-data/insights";
import { listJournalEntries } from "@/lib/services/journal.service";
import { getSystemColorVar } from "@/lib/colors";
import { BodyKnowledgeSection } from "@/components/body/body-knowledge-section";
import { NotebookPen } from "lucide-react";
import { format, parseISO } from "date-fns";

export async function BrainDetail({ system }: { system: BodySystem }) {
  const biomarkers = await listBiomarkersForSystem("brain");
  const relatedInsights = insights.filter((i) => i.relatedSystem === "brain");
  const journalEntries = await listJournalEntries();
  const moodEntries = journalEntries.filter((e) => e.tags.some((t) => t.category === "mood"));
  const color = getSystemColorVar("brain");
  const flagship = biomarkers.find((b) => b.id === "sleep_score") ?? biomarkers[0];

  return (
    <div className="flex flex-col gap-5">
      <SystemPanelHeader system={system} />
      <SystemTabs
        biomarkers={
          biomarkers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No sleep or recovery data yet — import wearable data from Profile to see it here.
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
          flagship ? (
            <div className="rounded-xl border border-border-soft bg-surface p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">{flagship.name} over time</h3>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/profile/biomarker/${flagship.id}`}>Full history</Link>
                </Button>
              </div>
              <TrendChart data={flagship.history} unit={flagship.unit} color={color} ranges={flagship.ranges} height={260} />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No trend data yet.</div>
          )
        }
        relationships={
          <>
            <div className="rounded-xl border border-border-soft bg-surface p-5">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-foreground">Subjective wellbeing</h3>
                <Badge variant="gold">From your journal</Badge>
              </div>
              <p className="mt-2 max-w-2xl text-[13px] text-muted-foreground">
                These reflect your own words, not clinical measurement — shown separately from wearable data on purpose.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {moodEntries.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 rounded-xl border border-border-soft bg-surface p-4">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-system-brain-soft text-system-brain">
                    <NotebookPen className="h-4 w-4" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-muted-foreground">{format(parseISO(entry.date), "d MMM yyyy")}</p>
                    <p className="mt-0.5 text-sm text-foreground">{entry.text}</p>
                  </div>
                  <SourceBadge source={{ type: "journal", label: "Journal", subjective: true }} />
                </div>
              ))}
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
          <BodyKnowledgeSection
            bodySystem="BRAIN"
            fallbackSummary="Sleep architecture (deep/REM), heart-rate-derived stress, and subjective mood/energy together describe recovery capacity. Sleep and stress are two-way: poor sleep raises next-day stress reactivity, and elevated stress fragments the following night's sleep."
          />
        }
      />
    </div>
  );
}
