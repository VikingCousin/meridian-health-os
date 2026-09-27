import { BodySystem } from "@/types/health";
import { SystemPanelHeader } from "@/components/body/system-panel-header";
import { SystemTabs } from "@/components/body/system-tabs";
import { BiomarkerCard } from "@/components/health/biomarker-card";
import { TrendChart } from "@/components/charts/trend-chart";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { timelineEvents } from "@/lib/mock-data/timeline";
import { mockUser } from "@/lib/mock-data/user";
import { listJournalEntries } from "@/lib/services/journal.service";
import { getBiomarkerDetail } from "@/lib/services/biomarker.service";
import { getSystemColorVar } from "@/lib/colors";
import { BodyKnowledgeSection } from "@/components/body/body-knowledge-section";
import { format, parseISO } from "date-fns";

export async function MusculoskeletalDetail({ system }: { system: BodySystem }) {
  const trainingLoad = await getBiomarkerDetail("training_load");
  const trainingEvents = timelineEvents.filter((e) => e.type === "training");
  const journalEntries = await listJournalEntries();
  const sorenessEntries = journalEntries.filter((e) => e.tags.some((t) => t.label === "Soreness"));
  const color = getSystemColorVar("musculoskeletal");

  return (
    <div className="flex flex-col gap-5">
      <SystemPanelHeader system={system} />
      <SystemTabs
        biomarkers={
          <>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {mockUser.weeklyTraining.map((t) => (
                <div key={t.label} className="rounded-xl border border-border-soft bg-surface p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{t.label}</p>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {t.completed}/{t.target}
                    </span>
                  </div>
                  <Progress className="mt-3" value={(t.completed / t.target) * 100} indicatorClassName="bg-system-musculoskeletal" />
                </div>
              ))}
            </div>
            {trainingLoad ? (
              <BiomarkerCard biomarker={trainingLoad} />
            ) : (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No training load data yet — import wearable data from Profile to see it here.
              </div>
            )}
          </>
        }
        trend={
          trainingLoad ? (
            <div className="rounded-xl border border-border-soft bg-surface p-5">
              <h3 className="mb-4 text-sm font-medium text-foreground">Training load over time</h3>
              <TrendChart data={trainingLoad.history} unit={trainingLoad.unit} color={color} ranges={trainingLoad.ranges} height={260} />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No trend data yet.</div>
          )
        }
        relationships={
          <>
            <div>
              <h3 className="mb-3 text-sm font-medium text-foreground">Recent sessions</h3>
              <div className="flex flex-col gap-2.5">
                {trainingEvents.map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded-xl border border-border-soft bg-surface p-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">{e.title}</p>
                      <p className="text-xs text-muted-foreground">{e.detail}</p>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">{format(parseISO(e.date), "d MMM")}</span>
                  </div>
                ))}
              </div>
            </div>
            {sorenessEntries.length > 0 && (
              <div className="rounded-xl border border-border-soft bg-surface p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-foreground">Pain &amp; soreness observations</h3>
                  <Badge variant="outline">Subjective</Badge>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {sorenessEntries.map((e) => (
                    <p key={e.id} className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{format(parseISO(e.date), "d MMM")}:</span> {e.text}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </>
        }
        knowledge={
          <BodyKnowledgeSection
            bodySystem="MUSCULOSKELETAL"
            fallbackSummary="Training load, weekly session adherence, and self-reported soreness together describe recovery balance — rising load without matching recovery is when soreness and injury risk tend to build."
          />
        }
      />
    </div>
  );
}
