"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { addManualMeasurementAction } from "@/lib/actions/biomarkers";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { PenLine, XCircle, CheckCircle2 } from "lucide-react";

interface BiomarkerOption {
  id: string;
  displayName: string;
  category: string;
  defaultUnit?: string | null;
}

export function AddManualBiomarkerDialog({
  biomarkerOptions,
  trigger,
}: {
  biomarkerOptions: BiomarkerOption[];
  trigger?: React.ReactNode;
}) {
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [isPending, startTransition] = useTransition();

  const selected = biomarkerOptions.find((b) => b.id === selectedId);

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await addManualMeasurementAction({
        biomarkerDefinitionId: formData.get("biomarkerDefinitionId"),
        value: formData.get("value"),
        unit: formData.get("unit"),
        measuredAt: formData.get("measuredAt") || new Date().toISOString(),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSaved(false);
          setError(null);
          setSelectedId("");
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <PenLine className="h-3.5 w-3.5" /> {t("labUpload.enterManually")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("manualBiomarker.title")}</DialogTitle>
        </DialogHeader>
        {saved ? (
          <div className="mt-4 flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle2 className="h-6 w-6 text-accent" />
            <p className="text-sm font-medium">{t("manualBiomarker.saved")}</p>
            <Button size="sm" className="mt-1" onClick={() => setOpen(false)}>
              {t("manualBiomarker.done")}
            </Button>
          </div>
        ) : (
          <form action={handleSubmit} className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              {t("manualBiomarker.biomarker")}
              <select
                name="biomarkerDefinitionId"
                required
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
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
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                {t("manualBiomarker.value")}
                <input name="value" type="number" step="any" required className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                {t("manualBiomarker.unit")}
                <input
                  name="unit"
                  required
                  maxLength={30}
                  defaultValue={selected?.defaultUnit ?? ""}
                  key={selected?.defaultUnit ?? "unit"}
                  className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              {t("manualBiomarker.dateMeasured")}
              <input name="measuredAt" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </label>
            {error && (
              <p className="flex items-center gap-1.5 text-[13px] text-danger">
                <XCircle className="h-3.5 w-3.5" /> {error}
              </p>
            )}
            <Button type="submit" disabled={isPending} className="mt-1">
              {isPending ? t("common.saving") : t("common.save")}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
