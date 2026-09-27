"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, UploadCloud, CheckCircle2, AlertTriangle, XCircle, FileText } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { inspectKnowledgeImportAction, importKnowledgeAction } from "@/lib/actions/knowledge";

type Step = "choose" | "preview" | "done";

const SOURCE_OPTIONS = [
  { value: "USER_NOTES", label: "Your notes" },
  { value: "NOTEBOOKLM_EXPORT", label: "NotebookLM export" },
  { value: "GUIDELINE", label: "Guideline" },
  { value: "RESEARCH_SUMMARY", label: "Research summary" },
  { value: "OTHER", label: "Other" },
] as const;

type InspectResult = Awaited<ReturnType<typeof inspectKnowledgeImportAction>>;

export default function KnowledgeImportPage() {
  const [step, setStep] = useState<Step>("choose");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Extract<InspectResult, { ok: true }> | null>(null);
  const [sourceType, setSourceType] = useState<(typeof SOURCE_OPTIONS)[number]["value"]>("USER_NOTES");
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runInspect = (chosen: File) => {
    setError(null);
    setFile(chosen);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("file", chosen);
      const result = await inspectKnowledgeImportAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPreview(result);
      setStep("preview");
    });
  };

  const runImport = () => {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("sourceType", sourceType);
      const result = await importKnowledgeAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setImportedCount(result.sectionCount);
      setStep("done");
    });
  };

  return (
    <PageContainer className="animate-fade-in-up max-w-2xl">
      <Link href="/knowledge" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Knowledge library
      </Link>

      <PageHeader
        eyebrow="Import"
        title="Import health knowledge"
        description="Markdown or plain text — your own notes, a NotebookLM export, or a guideline. Parsed deterministically by heading, never by AI, and never silently imported without a preview."
      />

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl bg-danger-soft p-4 text-sm text-danger">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {step === "choose" && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) runInspect(dropped);
          }}
          className={cn(
            "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-12 text-center transition-colors",
            dragActive ? "border-accent bg-accent-soft" : "border-border bg-surface-muted/40"
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-accent">
            <UploadCloud className="h-6 w-6" strokeWidth={1.6} />
          </div>
          <p className="font-medium">{isPending ? "Reading file…" : "Drag and drop a .md or .txt file"}</p>
          <p className="text-sm text-muted-foreground">or</p>
          <Button onClick={() => fileInputRef.current?.click()} variant="outline" disabled={isPending}>
            Choose a file
          </Button>
          <p className="text-xs text-muted-foreground">Markdown or plain text · up to 2 MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            className="hidden"
            onChange={(e) => {
              const chosen = e.target.files?.[0];
              if (chosen) runInspect(chosen);
            }}
          />
        </div>
      )}

      {step === "preview" && preview && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-xl bg-surface-muted p-4">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{preview.title}</span>
            </div>
            <Badge variant="gold">{preview.sections.length} section{preview.sections.length === 1 ? "" : "s"}</Badge>
          </div>

          {preview.alreadyImported && (
            <div className="flex items-start gap-2.5 rounded-xl bg-info-soft p-4 text-sm text-info">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>This exact content is already in your library — importing again will not create a duplicate.</p>
            </div>
          )}

          {preview.warnings.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-xl bg-warn-soft p-4 text-sm text-warn">
              {preview.warnings.map((w, i) => (
                <p key={i} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {w}
                </p>
              ))}
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground">Source type</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {SOURCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSourceType(opt.value)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    sourceType === opt.value ? "border-accent bg-accent-soft text-accent" : "border-border text-muted-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Choose honestly — your notes are never shown as guideline-level authority.
            </p>
          </div>

          <div className="flex flex-col divide-y divide-border-soft rounded-2xl border border-border-soft bg-surface">
            {preview.sections.map((s, i) => (
              <div key={i} className="px-4 py-3">
                <p className="text-sm font-medium">{s.heading}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.preview}{s.preview.length >= 200 ? "…" : ""}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setStep("choose");
                setPreview(null);
                setFile(null);
              }}
            >
              Choose a different file
            </Button>
            <Button onClick={runImport} disabled={isPending || preview.sections.length === 0}>
              {isPending ? "Importing…" : "Import into library"}
            </Button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border-soft bg-surface p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
            <CheckCircle2 className="h-6 w-6" strokeWidth={1.6} />
          </div>
          <p className="font-medium">Added to your knowledge library</p>
          <p className="text-sm text-muted-foreground">{importedCount} section{importedCount === 1 ? "" : "s"} imported.</p>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/knowledge/import">Import another</Link>
            </Button>
            <Button asChild>
              <Link href="/knowledge">Back to library</Link>
            </Button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
