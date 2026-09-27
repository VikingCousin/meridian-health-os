import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Watch } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { TechnicalPanel } from "@/components/ui/technical-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WearableImportWizard } from "@/components/wearables/wearable-import-wizard";
import { getAmazfitSummary } from "@/lib/services/wearable-data-source.service";

const statusMeta: Record<string, { label: string; variant: "accent" | "neutral" | "warn" | "danger" }> = {
  NOT_CONFIGURED: { label: "Not configured", variant: "neutral" },
  CONNECTED: { label: "Imported", variant: "accent" },
  NEEDS_IMPORT: { label: "Needs new import", variant: "warn" },
  ERROR: { label: "Error", variant: "danger" },
};

const importStatusVariant: Record<string, "accent" | "warn" | "danger" | "neutral"> = {
  COMPLETED: "accent",
  PARTIAL: "warn",
  FAILED: "danger",
  IMPORTING: "neutral",
  PENDING: "neutral",
  INSPECTED: "neutral",
};

export default async function DataSourcesPage() {
  const summary = await getAmazfitSummary();
  const status = statusMeta[summary.dataSource.status];

  return (
    <PageContainer className="animate-fade-in-up">
      <div>
        <Link href="/profile" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Profile
        </Link>
      </div>
      <PageHeader eyebrow="Data sources" title="Wearables" description="Import and manage data from your Amazfit / Zepp device." />

      <TechnicalPanel eyebrow="Wearable" className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
              <Watch className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <p className="font-medium text-foreground">{summary.dataSource.displayName}</p>
              {summary.dataSource.deviceName && <p className="text-[13px] text-muted-foreground">Device: {summary.dataSource.deviceName}</p>}
              <div className="mt-2">
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
            </div>
          </div>
          <WearableImportWizard />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border-soft pt-4 text-[13px] sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Last import</p>
            <p className="mt-0.5 font-medium text-foreground">{summary.dataSource.lastImportAt ? format(summary.dataSource.lastImportAt, "d MMM yyyy") : "Never"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Data range</p>
            <p className="mt-0.5 font-medium text-foreground">
              {summary.dateRangeStart && summary.dateRangeEnd ? `${format(summary.dateRangeStart, "MMM d")} – ${format(summary.dateRangeEnd, "MMM d, yyyy")}` : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Records</p>
            <p className="mt-0.5 font-medium text-foreground">{summary.totalMeasurements + summary.sleepSessionCount + summary.workoutCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Metrics</p>
            <p className="mt-0.5 font-medium capitalize text-foreground">{summary.metricKeys.length > 0 ? summary.metricKeys.slice(0, 3).join(", ").replace(/_/g, " ") : "None yet"}</p>
          </div>
        </div>
      </TechnicalPanel>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-foreground">Import history</h2>
        {summary.importHistory.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No imports yet.</div>
        ) : (
          <TechnicalPanel className="flex flex-col divide-y divide-border-soft">
            {summary.importHistory.map((session) => (
              <div key={session.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{session.originalFileName ?? "Import"}</p>
                  <p className="text-[12px] text-muted-foreground">{format(session.startedAt, "d MMM yyyy, HH:mm")}</p>
                </div>
                <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
                  <span>{session.recordsImported} imported</span>
                  <span>{session.recordsSkipped} skipped</span>
                  <Badge variant={importStatusVariant[session.status]}>{session.status}</Badge>
                </div>
              </div>
            ))}
          </TechnicalPanel>
        )}
      </section>

      <div className="rounded-2xl border border-dashed border-border p-5 text-[13px] text-muted-foreground">
        <p>
          Imports are parsed entirely on this machine — no wearable export is ever sent to Anthropic or OpenAI. See{" "}
          <span className="font-medium text-foreground">docs/WEARABLE_ARCHITECTURE.md</span> for exactly what this connector does and doesn&apos;t support yet.
        </p>
      </div>

      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href="/profile">Back to Profile</Link>
      </Button>
    </PageContainer>
  );
}
