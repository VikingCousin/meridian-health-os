import Link from "next/link";
import { BodySystem, BodySystemId } from "@/types/health";
import { SystemPanelHeader } from "@/components/body/system-panel-header";
import { SystemTabs } from "@/components/body/system-tabs";
import { BiomarkerCard } from "@/components/health/biomarker-card";
import { TrendChart } from "@/components/charts/trend-chart";
import { Button } from "@/components/ui/button";
import { listBiomarkersForSystem } from "@/lib/services/biomarker.service";
import { getSystemColorVar } from "@/lib/colors";
import { BodyKnowledgeSection } from "@/components/body/body-knowledge-section";
import { fromUiBodySystem } from "@/lib/services/enum-maps";

const RELATIONSHIP_TEXT: Partial<Record<BodySystemId, string>> = {
  metabolic:
    "Metabolic health (glucose control, body composition) sits upstream of cardiovascular risk and downstream of sleep and training consistency — poor sleep and inconsistent training both tend to push glucose and body fat trends the wrong way.",
  kidneys:
    "Kidney function markers (creatinine, eGFR) are influenced by hydration, muscle mass, and cardiovascular health — they're best read as a trend over multiple panels rather than a single value.",
};

export async function GenericSystemDetail({ system }: { system: BodySystem }) {
  const biomarkers = await listBiomarkersForSystem(system.id);
  const color = getSystemColorVar(system.id);
  const flagshipBiomarker = biomarkers[0];

  return (
    <div className="flex flex-col gap-5">
      <SystemPanelHeader system={system} />
      <SystemTabs
        biomarkers={
          biomarkers.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {biomarkers.map((b) => (
                <BiomarkerCard key={b.id} biomarker={b} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No biomarkers logged for this system yet.
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
          <div className="rounded-xl border border-border-soft bg-surface p-5">
            <h3 className="text-sm font-medium text-foreground">How this connects</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              {RELATIONSHIP_TEXT[system.id] ?? "Relationship context for this system isn't available yet."}
            </p>
          </div>
        }
        knowledge={
          <BodyKnowledgeSection
            bodySystem={fromUiBodySystem(system.id)}
            fallbackSummary={`General information about ${system.name.toLowerCase()} will appear here once it's been curated or imported.`}
          />
        }
      />
    </div>
  );
}
