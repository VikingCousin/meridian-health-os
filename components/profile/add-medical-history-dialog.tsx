"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { addMedicalHistoryAction } from "@/lib/actions/profile";
import { Plus, XCircle } from "lucide-react";

export function AddMedicalHistoryDialog() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await addMedicalHistoryAction({
        condition: formData.get("condition"),
        diagnosisDate: formData.get("diagnosisDate") || undefined,
        status: formData.get("status"),
        source: formData.get("source"),
        notes: formData.get("notes") || undefined,
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
        <Button variant="subtle" size="sm">
          <Plus className="h-3.5 w-3.5" /> Add condition
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add medical history</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Condition
            <input name="condition" required maxLength={200} className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Diagnosis date
              <input name="diagnosisDate" type="date" className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Status
              <select name="status" defaultValue="ACTIVE" className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
                <option value="ACTIVE">Active</option>
                <option value="MANAGED">Managed</option>
                <option value="RESOLVED">Resolved</option>
                <option value="SUSPECTED">Suspected</option>
                <option value="HISTORICAL">Historical</option>
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            How confident is this?
            <select name="source" defaultValue="SELF_REPORTED" className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
              <option value="SELF_REPORTED">Self-reported</option>
              <option value="DOCTOR_DIAGNOSED">Doctor-diagnosed</option>
              <option value="DOCUMENT_IMPORTED">From an imported document</option>
              <option value="AI_EXTRACTED">AI-extracted</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Notes
            <textarea name="notes" rows={2} maxLength={2000} className="resize-none rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </label>
          {error && (
            <p className="flex items-center gap-1.5 text-[13px] text-danger">
              <XCircle className="h-3.5 w-3.5" /> {error}
            </p>
          )}
          <Button type="submit" disabled={isPending} className="mt-1">
            {isPending ? "Saving…" : "Add"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
