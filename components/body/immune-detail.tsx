import { BodySystem } from "@/types/health";
import { SystemPanelHeader } from "@/components/body/system-panel-header";
import { SystemTabs } from "@/components/body/system-tabs";
import { BiomarkerCard } from "@/components/health/biomarker-card";
import { RadialMetric } from "@/components/health/radial-metric";
import { TechnicalPanel } from "@/components/ui/technical-panel";
import { TrendChart } from "@/components/charts/trend-chart";
import { listBiomarkersForSystem, getBiomarkerDetail } from "@/lib/services/biomarker.service";
import { getSystemColorVar } from "@/lib/colors";
import { BodyKnowledgeSection } from "@/components/body/body-knowledge-section";

const CBC_PANEL: { key: string; shortLabel: string }[] = [
  { key: "erythrocytes", shortLabel: "RBC" },
  { key: "hemoglobin", shortLabel: "Hgb" },
  { key: "hematocrit", shortLabel: "Hct" },
  { key: "leukocytes", shortLabel: "WBC" },
  { key: "neutrophils", shortLabel: "Neutrophils" },
  { key: "lymphocytes", shortLabel: "Lymphocytes" },
  { key: "monocytes", shortLabel: "Monocytes" },
  { key: "eosinophils", shortLabel: "Eosinophils" },
  { key: "basophils", shortLabel: "Basophils" },
  { key: "platelets", shortLabel: "Platelets" },
];

export async function ImmuneDetail({ system }: { system: BodySystem }) {
  const [biomarkers, cbcResults] = await Promise.all([
    listBiomarkersForSystem("immune"),
    Promise.all(CBC_PANEL.map((m) => getBiomarkerDetail(m.key))),
  ]);
  const color = getSystemColorVar("immune");
  const flagshipBiomarker = biomarkers.find((b) => b.id === "hs_crp") ?? biomarkers[0];
  const dataPointCount = cbcResults.filter(Boolean).length;

  return (
    <div className="flex flex-col gap-5">
      <SystemPanelHeader system={system} />
      <SystemTabs
        biomarkers={
          <>
            <TechnicalPanel eyebrow={`Blood differential — ${dataPointCount}/${CBC_PANEL.length} markers on file`} statusDotClassName="bg-system-immune">
              <div className="grid grid-cols-2 gap-y-5 p-5 sm:grid-cols-3 xl:grid-cols-5">
                {CBC_PANEL.map((m, i) => {
                  const result = cbcResults[i];
                  const referenceRange = result?.ranges.find((r) => r.kind === "lab_reference");
                  return (
                    <RadialMetric
                      key={m.key}
                      label={m.shortLabel}
                      shortLabel={m.shortLabel}
                      value={result?.currentValue}
                      unit={result?.unit}
                      referenceMin={referenceRange?.min}
                      referenceMax={referenceRange?.max}
                      color={color}
                    />
                  );
                })}
              </div>
            </TechnicalPanel>
            {biomarkers.length > 0 && (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {biomarkers.map((b) => (
                  <BiomarkerCard key={b.id} biomarker={b} />
                ))}
              </div>
            )}
          </>
        }
        trend={
          flagshipBiomarker ? (
            <div className="rounded-xl border border-border-soft bg-surface p-5">
              <h3 className="mb-4 text-sm font-medium text-foreground">{flagshipBiomarker.name} over time</h3>
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
              Immune markers shift with acute illness, recent training load, poor sleep, and inflammation
              elsewhere in the body (gut, metabolic). A single differential is a snapshot — the pattern across
              panels over time is more informative than any one value.
            </p>
          </div>
        }
        knowledge={
          <BodyKnowledgeSection
            bodySystem="IMMUNE"
            fallbackSummary="A complete blood count with differential breaks white blood cells into subtypes — neutrophils and monocytes respond quickly to bacterial threats, lymphocytes are central to adaptive immunity, and eosinophils/basophils are more associated with allergic and parasitic responses."
          />
        }
      />
    </div>
  );
}
