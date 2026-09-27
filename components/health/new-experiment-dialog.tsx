"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createExperimentAction } from "@/lib/actions/experiments";
import { Plus, XCircle } from "lucide-react";

const metricTypes = [
  { value: "BIOMARKER", label: "Biomarker" },
  { value: "JOURNAL_OBSERVATION", label: "Journal observation" },
  { value: "SUBJECTIVE_RATING", label: "Subjective rating" },
  { value: "OTHER", label: "Other" },
] as const;

export interface ExperimentPrefill {
  title?: string;
  hypothesis?: string;
  protocol?: string;
  durationDays?: number;
  outcomes?: { label: string; metricType: (typeof metricTypes)[number]["value"]; metricReference?: string }[];
}

interface NewExperimentDialogProps {
  /** Custom trigger content, e.g. a "Test this" button from an Insight Detail page. */
  trigger?: React.ReactNode;
  /**
   * Pre-fills the form (e.g. from a pattern insight's "Test this" action) but
   * never submits on its own — the user still has to review and confirm.
   */
  defaultValues?: ExperimentPrefill;
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function NewExperimentDialog({ trigger, defaultValues }: NewExperimentDialogProps = {}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcomeRows, setOutcomeRows] = useState(defaultValues?.outcomes?.length ? defaultValues.outcomes.map((_, i) => i) : [0]);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const today = new Date();
  const defaultStartDate = toDateInputValue(today);
  const defaultEndDate = toDateInputValue(new Date(today.getTime() + (defaultValues?.durationDays ?? 14) * 86_400_000));

  const handleSubmit = (formData: FormData) => {
    setError(null);
    const outcomes = outcomeRows
      .map((i) => ({
        label: (formData.get(`outcomeLabel-${i}`) as string)?.trim(),
        metricType: formData.get(`outcomeType-${i}`) as string,
        metricReference: (formData.get(`outcomeRef-${i}`) as string)?.trim() || undefined,
      }))
      .filter((o) => o.label);

    startTransition(async () => {
      const result = await createExperimentAction({
        title: formData.get("title"),
        hypothesis: formData.get("hypothesis"),
        protocol: formData.get("protocol"),
        startDate: formData.get("startDate"),
        endDate: formData.get("endDate"),
        status: "ACTIVE",
        outcomes,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="h-4 w-4" /> New experiment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{defaultValues ? "Test this pattern" : "New experiment"}</DialogTitle>
          <DialogDescription>
            {defaultValues
              ? "Review and adjust before creating — nothing is saved until you confirm."
              : "Turn an observation into a testable personal hypothesis."}
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Title
            <input name="title" required maxLength={150} defaultValue={defaultValues?.title} className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Hypothesis
            <textarea name="hypothesis" required rows={2} maxLength={500} defaultValue={defaultValues?.hypothesis} className="resize-none rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Protocol
            <textarea name="protocol" required rows={2} maxLength={500} defaultValue={defaultValues?.protocol} className="resize-none rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Start date
              <input name="startDate" type="date" required defaultValue={defaultStartDate} className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              End date
              <input name="endDate" type="date" required defaultValue={defaultEndDate} className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </label>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-border-soft p-3">
            <p className="text-xs font-medium text-muted-foreground">Tracked outcomes</p>
            {outcomeRows.map((i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  name={`outcomeLabel-${i}`}
                  placeholder="e.g. HRV"
                  maxLength={120}
                  defaultValue={defaultValues?.outcomes?.[i]?.label}
                  className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
                <select name={`outcomeType-${i}`} defaultValue={defaultValues?.outcomes?.[i]?.metricType ?? "BIOMARKER"} className="rounded-lg border border-border-soft bg-surface-muted/40 px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent/30">
                  {metricTypes.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <input
                  name={`outcomeRef-${i}`}
                  placeholder="canonical key (optional), e.g. hrv"
                  defaultValue={defaultValues?.outcomes?.[i]?.metricReference}
                  className="col-span-2 rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setOutcomeRows((prev) => [...prev, prev.length])}
              className="self-start text-xs font-medium text-accent hover:underline"
            >
              + Add another outcome
            </button>
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-[13px] text-danger">
              <XCircle className="h-3.5 w-3.5" /> {error}
            </p>
          )}
          <Button type="submit" disabled={isPending} className="mt-1">
            {isPending ? "Saving…" : "Create experiment"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
