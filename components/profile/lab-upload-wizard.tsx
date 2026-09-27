"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExtractedLabValue } from "@/types/health";
import { uploadDocumentAction, updateExtractionItemAction, confirmExtractionAction } from "@/lib/actions/documents";
import { AddManualBiomarkerDialog } from "@/components/profile/add-manual-biomarker-dialog";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { UploadCloud, FileText, Sparkles, CheckCircle2, AlertTriangle, HelpCircle, ChevronLeft, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = "upload" | "extracting" | "review" | "saved";

const TIER_META: Record<ExtractedLabValue["confidenceTier"], { key: string; className: string }> = {
  high: { key: "labUpload.confidenceHigh", className: "bg-accent-soft text-accent" },
  medium: { key: "labUpload.confidenceMedium", className: "bg-gold-soft text-gold" },
  low: { key: "labUpload.confidenceLow", className: "bg-warn-soft text-warn" },
  unrecognized: { key: "labUpload.confidenceUnrecognized", className: "bg-danger-soft text-danger" },
};

interface BiomarkerOption {
  id: string;
  displayName: string;
  category: string;
  defaultUnit?: string | null;
}

export function LabUploadWizard({
  demoMode,
  externalAiEnabled,
  biomarkerOptions,
}: {
  demoMode: boolean;
  externalAiEnabled: boolean;
  biomarkerOptions: BiomarkerOption[];
}) {
  const { t } = useTranslations();
  const steps: { id: Step; labelKey: string }[] = [
    { id: "upload", labelKey: "labUpload.stepUpload" },
    { id: "extracting", labelKey: "labUpload.stepExtracting" },
    { id: "review", labelKey: "labUpload.stepReview" },
    { id: "saved", labelKey: "labUpload.stepSaved" },
  ];
  const [step, setStep] = useState<Step>("upload");
  const [values, setValues] = useState<ExtractedLabValue[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [documentDate, setDocumentDate] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [skippedUnmappedCount, setSkippedUnmappedCount] = useState(0);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runUpload = (file: File) => {
    setError(null);
    setStep("extracting");
    startTransition(async () => {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("type", "LAB_REPORT");

      const result = await uploadDocumentAction(formData);
      if (!result.ok) {
        setError(result.error);
        setStep("upload");
        return;
      }
      setSessionId(result.sessionId);
      setDocumentDate(result.documentDate);
      setValues(result.values);
      setStep("review");
    });
  };

  const updateValue = (id: string, patch: Partial<ExtractedLabValue>) => {
    setValues((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));

    const numericValue = Number(patch.value ?? values.find((v) => v.id === id)?.value);
    if (patch.value !== undefined && Number.isNaN(numericValue)) return; // wait for a valid number before syncing

    startTransition(async () => {
      const current = values.find((v) => v.id === id);
      if (!current) return;
      await updateExtractionItemAction(id, {
        value: patch.value !== undefined ? numericValue : Number(current.value),
        unit: current.unit,
        accepted: patch.confirmed ?? current.confirmed,
        finalBiomarkerDefinitionId: patch.biomarkerDefinitionId ?? current.biomarkerDefinitionId,
      });
    });
  };

  const mapUnrecognized = (id: string, biomarkerDefinitionId: string) => {
    updateValue(id, { biomarkerDefinitionId, mapped: true, confidenceTier: "medium", confirmed: true });
  };

  const handleSave = () => {
    if (!sessionId) return;
    setError(null);
    startTransition(async () => {
      const result = await confirmExtractionAction(sessionId);
      if (!result.ok) {
        setError(t("common.unknownError"));
        return;
      }
      setImportedCount(result.importedCount);
      setSkippedUnmappedCount(result.skippedUnmappedCount);
      setStep("saved");
    });
  };

  const confirmedCount = values.filter((v) => v.confirmed).length;
  const stepIndex = steps.findIndex((s) => s.id === step);

  return (
    <PageContainer className="animate-fade-in-up max-w-2xl">
      <Link href="/profile" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> {t("labUpload.profileLink")}
      </Link>

      <PageHeader
        eyebrow={t("labUpload.eyebrow")}
        title={t("labUpload.title")}
        description={
          demoMode
            ? t("labUpload.descriptionDemo")
            : externalAiEnabled
              ? t("labUpload.descriptionReal")
              : t("labUpload.descriptionAiOff")
        }
      />

      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.id} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                i <= stepIndex ? "bg-accent text-accent-foreground" : "bg-surface-muted text-muted-foreground"
              )}
            >
              {i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className={cn("h-px flex-1", i < stepIndex ? "bg-accent" : "bg-border-soft")} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="flex flex-col gap-3 rounded-xl bg-danger-soft p-4 text-sm text-danger">
          <div className="flex items-start gap-2.5">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-6.5">
            <Button asChild variant="outline" size="sm">
              <Link href="/privacy">{t("labUpload.settingUpAi")}</Link>
            </Button>
            <AddManualBiomarkerDialog biomarkerOptions={biomarkerOptions} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setError(null);
                setStep("upload");
              }}
            >
              {t("common.tryAgain")}
            </Button>
          </div>
        </div>
      )}

      {step === "upload" && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            const file = e.dataTransfer.files?.[0];
            if (file) runUpload(file);
          }}
          className={cn(
            "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-12 text-center transition-colors",
            dragActive ? "border-accent bg-accent-soft" : "border-border bg-surface-muted/40"
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-accent">
            <UploadCloud className="h-6 w-6" strokeWidth={1.6} />
          </div>
          <p className="font-medium">{t("labUpload.dropzoneTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("labUpload.or")}</p>
          <Button onClick={() => fileInputRef.current?.click()} variant="outline">
            {t("labUpload.chooseFile")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("labUpload.fileHint")}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) runUpload(file);
            }}
          />
        </div>
      )}

      {step === "extracting" && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border-soft bg-surface p-12 text-center">
          <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-full bg-gold-soft text-gold">
            <Sparkles className="h-6 w-6" strokeWidth={1.6} />
          </div>
          <p className="font-medium">{t("labUpload.readingDocument")}</p>
          <p className="text-sm text-muted-foreground">{t("labUpload.readingDocumentDetail")}</p>
        </div>
      )}

      {step === "review" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-xl bg-surface-muted p-4">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>
                {t("labUpload.labDate")}: <strong>{documentDate ?? t("labUpload.notDetected")}</strong>
              </span>
            </div>
            <Badge variant="gold">{t("labUpload.valuesDetected", { count: values.length })}</Badge>
          </div>
          {values.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {t("labUpload.noValuesDetected")}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("labUpload.reviewInstruction")}</p>
          )}

          <div className="flex flex-col divide-y divide-border-soft rounded-2xl border border-border-soft bg-surface">
            {values.map((v) => {
              const tier = TIER_META[v.confidenceTier];
              return (
                <div key={v.id} className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{v.name}</p>
                      <span className={cn("mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", tier.className)}>
                        {v.confidenceTier === "unrecognized" ? <HelpCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                        {t(tier.key)}
                      </span>
                    </div>
                    <input
                      value={v.value}
                      onChange={(e) => updateValue(v.id, { value: e.target.value, confirmed: v.mapped })}
                      className="w-24 rounded-lg border border-border-soft bg-surface-muted/40 px-2.5 py-1.5 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                    <span className="w-16 shrink-0 text-xs text-muted-foreground">{v.unit}</span>
                    <button
                      onClick={() => v.mapped && updateValue(v.id, { confirmed: !v.confirmed })}
                      disabled={!v.mapped}
                      title={v.mapped ? undefined : t("labUpload.mapBeforeConfirm")}
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                        v.confirmed ? "border-accent bg-accent-soft text-accent" : "border-border text-muted-foreground/40",
                        !v.mapped && "cursor-not-allowed opacity-40"
                      )}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                  </div>
                  {v.referenceText && <p className="pl-0 text-[11px] text-muted-foreground">{t("labUpload.referenceText")}: {v.referenceText}</p>}
                  {!v.mapped && (
                    <div className="flex items-center gap-2 rounded-lg bg-surface-muted/60 px-3 py-2">
                      <span className="text-xs text-muted-foreground">{t("labUpload.mapPrompt")}</span>
                      <select
                        defaultValue=""
                        onChange={(e) => e.target.value && mapUnrecognized(v.id, e.target.value)}
                        className="flex-1 rounded-lg border border-border-soft bg-surface px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-accent/30"
                      >
                        <option value="" disabled>
                          {t("labUpload.chooseBiomarker")}
                        </option>
                        {biomarkerOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.displayName} ({opt.category})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{t("labUpload.confirmedCount", { confirmed: confirmedCount, total: values.length })}</p>
            <Button onClick={handleSave} disabled={isPending || confirmedCount === 0}>
              {isPending ? t("common.saving") : t("labUpload.saveToProfile")}
            </Button>
          </div>
        </div>
      )}

      {step === "saved" && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border-soft bg-surface p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
            <CheckCircle2 className="h-6 w-6" strokeWidth={1.6} />
          </div>
          <p className="font-medium">{t("labUpload.savedTitle")}</p>
          <p className="text-sm text-muted-foreground">
            {t("labUpload.savedDescription", { count: importedCount, date: documentDate ?? t("labUpload.notDetected") })}
          </p>
          {skippedUnmappedCount > 0 && (
            <p className="text-xs text-warn">{t("labUpload.skippedUnmapped", { count: skippedUnmappedCount })}</p>
          )}
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/timeline">{t("labUpload.viewTimeline")}</Link>
            </Button>
            <Button asChild>
              <Link href="/profile">{t("labUpload.backToProfile")}</Link>
            </Button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
