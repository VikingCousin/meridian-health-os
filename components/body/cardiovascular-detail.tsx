import Link from "next/link";
import { BodySystem } from "@/types/health";
import { SystemPanelHeader } from "@/components/body/system-panel-header";
import { SystemTabs } from "@/components/body/system-tabs";
import { BiomarkerCard } from "@/components/health/biomarker-card";
import { InsightCard } from "@/components/health/insight-card";
import { TrendChart } from "@/components/charts/trend-chart";
import { Button } from "@/components/ui/button";
import { listBiomarkersForSystem } from "@/lib/services/biomarker.service";
import { insights } from "@/lib/mock-data/insights";
import { getSystemColorVar } from "@/lib/colors";
import { BodyKnowledgeSection } from "@/components/body/body-knowledge-section";

export async function CardiovascularDetail({ system }: { system: BodySystem }) {
  const biomarkers = await listBiomarkersForSystem("cardiovascular");
  const relatedInsights = insights.filter((i) => i.relatedSystem === "cardiovascular");
  const color = getSystemColorVar("cardiovascular");
  const flagshipBiomarker = biomarkers.find((b) => b.id === "apob") ?? biomarkers[0];

  return (
    <div className="flex flex-col gap-5">
      <SystemPanelHeader system={system} />
      <SystemTabs
        biomarkers={
          biomarkers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No measurements yet for this system — add a lab report, import wearable data, or a manual entry to see history here.
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
              <TrendChart
                data={flagshipBiomarker.history}
                unit={flagshipBiomarker.unit}
                color={color}
                ranges={flagshipBiomarker.ranges}
                height={260}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                Every biomarker card in the Biomarkers tab has its own mini trend — open any card for full history.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No trend data yet.
            </div>
          )
        }
        relationships={
          <>
            <div className="rounded-xl border border-border-soft bg-surface p-5">
              <h3 className="text-sm font-medium text-foreground">How this connects</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                Cardiovascular health is tightly linked to metabolic health (glucose, body composition) and to
                training load and sleep (recovery drives HRV and resting heart rate). A change here is rarely
                caused by one thing in isolation.
              </p>
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
            bodySystem="CARDIOVASCULAR"
            fallbackSummary="Lipid particles (ApoB, LDL-C, HDL-C, triglycerides), blood pressure, and cardiac fitness markers (resting heart rate, HRV, VO2max) together describe how efficiently your heart and vessels move oxygen and how much atherogenic particle burden is circulating."
          />
        }
      />
    </div>
  );
}
