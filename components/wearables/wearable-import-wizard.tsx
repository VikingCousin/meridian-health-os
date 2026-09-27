"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { inspectWearableImportAction, importWearableFilesAction } from "@/lib/actions/wearable-import";
import { UploadCloud, AlertTriangle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";

type SourceType = "ZEPP" | "GENERIC_CSV";
type Step = "choose-source" | "pick-file" | "inspecting" | "review" | "importing" | "report" | "error";

interface InspectionUi {
  detected: boolean;
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
  metricCounts: Record<string, number>;
  sleepSessionCount: number;
  workoutCount: number;
  unknownFields: string[];
  warnings: { code: string; message: string }[];
}

interface ReportUi {
  status: "COMPLETED" | "PARTIAL" | "FAILED";
  recordsImported: number;
  recordsSkipped: number;
  recordsFailed: number;
  sleepSessionsImported: number;
  workoutsImported: number;
  warnings: { code: string; message: string }[];
}

const SOURCE_LABELS: Record<SourceType, string> = { ZEPP: "Amazfit / Zepp export", GENERIC_CSV: "Generic CSV" };

export function WearableImportWizard() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("choose-source");
  const [sourceType, setSourceType] = useState<SourceType>("ZEPP");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [inspection, setInspection] = useState<InspectionUi | null>(null);
  const [report, setReport] = useState<ReportUi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function reset() {
    setStep("choose-source");
    setInspection(null);
    setReport(null);
    setError(null);
    setSelectedFiles([]);
  }

  function handleFilesChosen(fileList: FileList) {
    const files = [...fileList];
    setSelectedFiles(files);
    setStep("inspecting");
    startTransition(async () => {
      const formData = new FormData();
      formData.set("sourceType", sourceType);
      for (const file of files) formData.append("files", file);
      const result = await inspectWearableImportAction(formData);
      if (!result.ok) {
        setError(result.error);
        setStep("error");
        return;
      }
      setInspection(result.inspection);
      setStep("review");
    });
  }

  function handleConfirmImport() {
    setStep("importing");
    startTransition(async () => {
      const formData = new FormData();
      formData.set("sourceType", sourceType);
      for (const file of selectedFiles) formData.append("files", file);
      const result = await importWearableFilesAction(formData);
      if (!result.ok) {
        setError(result.error);
        setStep("error");
        return;
      }
      setReport(result.result);
      setStep("report");
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <UploadCloud className="h-4 w-4" /> Import data
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import wearable data</DialogTitle>
          <DialogDescription>Parsed locally on this machine — nothing is sent to Anthropic or OpenAI.</DialogDescription>
        </DialogHeader>

        {step === "choose-source" && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-[13px] font-medium text-muted-foreground">Step 1 of 3 — Choose source</p>
            {(["ZEPP", "GENERIC_CSV"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSourceType(s)}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                  sourceType === s ? "border-accent bg-accent-soft text-foreground" : "border-border-soft bg-surface hover:bg-surface-elevated"
                }`}
              >
                <span>
                  <span className="font-medium">{SOURCE_LABELS[s]}</span>
                  <span className="mt-0.5 block text-[12px] text-muted-foreground">
                    {s === "ZEPP" ? "A .zip export from Settings → Privacy → Request my data in the Zepp app" : "A single .csv file with a date/time column"}
                  </span>
                </span>
              </button>
            ))}
            {sourceType === "ZEPP" && (
              <p className="flex items-start gap-1.5 rounded-lg bg-surface-elevated p-3 text-[12px] text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-state-watch" />
                This importer&apos;s Zepp format support is awaiting validation against a real export — unrecognized columns will be reported, not guessed at.
              </p>
            )}
            <Button className="mt-1" onClick={() => setStep("pick-file")}>
              Continue
            </Button>
          </div>
        )}

        {step === "pick-file" && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-[13px] font-medium text-muted-foreground">Step 2 of 3 — Select export file{sourceType === "ZEPP" ? "" : "s"}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept={sourceType === "ZEPP" ? ".zip,.csv" : ".csv"}
              multiple={sourceType === "GENERIC_CSV"}
              className="hidden"
              onChange={(e) => e.target.files && e.target.files.length > 0 && handleFilesChosen(e.target.files)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-8 text-center text-sm text-muted-foreground hover:border-accent hover:text-foreground"
            >
              <UploadCloud className="h-6 w-6" />
              Choose a file
            </button>
            <Button variant="ghost" onClick={() => setStep("choose-source")}>
              Back
            </Button>
          </div>
        )}

        {step === "inspecting" && (
          <div className="mt-8 flex flex-col items-center gap-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Reading your export…
          </div>
        )}

        {step === "review" && inspection && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-[13px] font-medium text-muted-foreground">Step 3 of 3 — Review</p>
            {inspection.dateRangeStart && inspection.dateRangeEnd && (
              <p className="text-sm text-foreground">
                Date range: <span className="font-medium">{format(inspection.dateRangeStart, "MMM d")} – {format(inspection.dateRangeEnd, "MMM d, yyyy")}</span>
              </p>
            )}
            <div className="flex flex-col gap-1.5 rounded-xl border border-border-soft bg-surface p-3 text-[13px]">
              {Object.entries(inspection.metricCounts).map(([key, count]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="capitalize text-muted-foreground">{key.replace(/_/g, " ")}</span>
                  <span className="font-mono font-medium text-foreground">{count}</span>
                </div>
              ))}
              {inspection.sleepSessionCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Sleep sessions</span>
                  <span className="font-mono font-medium text-foreground">{inspection.sleepSessionCount}</span>
                </div>
              )}
              {inspection.workoutCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Workouts</span>
                  <span className="font-mono font-medium text-foreground">{inspection.workoutCount}</span>
                </div>
              )}
              {Object.keys(inspection.metricCounts).length === 0 && inspection.sleepSessionCount === 0 && inspection.workoutCount === 0 && (
                <p className="text-muted-foreground">No recognized records found.</p>
              )}
            </div>
            {inspection.unknownFields.length > 0 && (
              <p className="text-[12px] text-muted-foreground">
                Unrecognized fields ({inspection.unknownFields.length}): {inspection.unknownFields.slice(0, 6).join(", ")}
                {inspection.unknownFields.length > 6 ? "…" : ""}
              </p>
            )}
            {inspection.warnings.length > 0 && (
              <details className="rounded-lg bg-surface-elevated p-3 text-[12px] text-muted-foreground">
                <summary className="cursor-pointer font-medium text-foreground">{inspection.warnings.length} warning(s)</summary>
                <ul className="mt-2 flex max-h-32 flex-col gap-1 overflow-y-auto">
                  {inspection.warnings.slice(0, 50).map((w, i) => (
                    <li key={i}>{w.message}</li>
                  ))}
                </ul>
              </details>
            )}
            <div className="mt-1 flex gap-2">
              <Button variant="ghost" onClick={() => setStep("pick-file")}>
                Back
              </Button>
              <Button className="flex-1" onClick={handleConfirmImport} disabled={isPending}>
                Import
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="mt-8 flex flex-col items-center gap-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Importing…
          </div>
        )}

        {step === "report" && report && (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              {report.status === "COMPLETED" ? <CheckCircle2 className="h-5 w-5 text-state-good" /> : <AlertTriangle className="h-5 w-5 text-state-watch" />}
              <p className="font-medium text-foreground">
                {report.status === "COMPLETED" ? "Import complete" : report.status === "PARTIAL" ? "Import partially completed" : "Import failed"}
              </p>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border border-border-soft bg-surface p-3 text-[13px]">
              <div className="flex justify-between"><span className="text-muted-foreground">Measurements imported</span><span className="font-mono font-medium">{report.recordsImported - report.sleepSessionsImported - report.workoutsImported}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Sleep sessions imported</span><span className="font-mono font-medium">{report.sleepSessionsImported}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Workouts imported</span><span className="font-mono font-medium">{report.workoutsImported}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Already present (skipped)</span><span className="font-mono font-medium">{report.recordsSkipped}</span></div>
              {report.recordsFailed > 0 && (
                <div className="flex justify-between text-state-elevated"><span>Failed</span><span className="font-mono font-medium">{report.recordsFailed}</span></div>
              )}
            </div>
            <Badge variant={report.status === "COMPLETED" ? "good" : report.status === "PARTIAL" ? "watch" : "danger"}>{report.status}</Badge>
            <Button
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Done
            </Button>
          </div>
        )}

        {step === "error" && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="flex items-center gap-1.5 text-sm text-danger">
              <XCircle className="h-4 w-4" /> {error}
            </p>
            <Button variant="outline" onClick={() => setStep("choose-source")}>
              Try again
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
