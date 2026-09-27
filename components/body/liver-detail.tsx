import Link from "next/link";
import { BodySystem } from "@/types/health";
import { SystemPanelHeader } from "@/components/body/system-panel-header";
import { SystemTabs } from "@/components/body/system-tabs";
import { BiomarkerCard } from "@/components/health/biomarker-card";
import { LiverIllustration } from "@/components/body/liver-illustration";
import { TrendChart } from "@/components/charts/trend-chart";
import { Button } from "@/components/ui/button";
import { listBiomarkersForSystem } from "@/lib/services/biomarker.service";
import { getSystemColorVar } from "@/lib/colors";
import { BodyKnowledgeSection } from "@/components/body/body-knowledge-section";

export async function LiverDetail({ system }: { system: BodySystem }) {
  const biomarkers = await listBiomarkersForSystem("liver");
  const color = getSystemColorVar("liver");
  const flagshipBiomarker = biomarkers.find((b) => b.id === "alt") ?? biomarkers[0];

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
              No liver panel data yet — upload a lab report to see ALT, AST, GGT, and bilirubin here.
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
              Liver enzymes are sensitive to alcohol intake, some medications and supplements, rapid weight
              change, and metabolic health more broadly — they&apos;re worth reading alongside your metabolic and
              body-composition trends, not in isolation.
            </p>
          </div>
        }
        knowledge={
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-border-soft bg-surface-elevated p-6">
              <LiverIllustration />
              <p className="mx-auto mt-3 max-w-md text-center text-xs text-muted-foreground">
                A simplified hepatocyte (liver cell) diagram — illustrative, not to biological scale.
              </p>
            </div>
            <BodyKnowledgeSection
              bodySystem="LIVER"
              fallbackSummary="ALT, AST, and GGT originate from different cellular compartments and tissues — the pattern across all three (not any single value) is what carries information. Interpretation depends on magnitude, pattern, and clinical context."
            />
          </div>
        }
      />
    </div>
  );
}
