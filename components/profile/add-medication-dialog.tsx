"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { addMedicationAction, addSupplementAction } from "@/lib/actions/profile";
import { Plus, XCircle } from "lucide-react";

export function AddMedicationDialog({ kind }: { kind: "medication" | "supplement" }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const action = kind === "medication" ? addMedicationAction : addSupplementAction;

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await action({
        name: formData.get("name"),
        productName: formData.get("productName") || undefined,
        dose: formData.get("dose") || undefined,
        unit: formData.get("unit") || undefined,
        frequency: formData.get("frequency") || undefined,
        startedAt: formData.get("startedAt") || undefined,
        active: true,
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
          <Plus className="h-3.5 w-3.5" /> Add {kind}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add {kind}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Name
            <input name="name" required maxLength={150} className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </label>
          {kind === "supplement" && (
            <label className="flex flex-col gap-1 text-sm">
              Product name
              <input name="productName" maxLength={150} className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </label>
          )}
          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Dose
              <input name="dose" type="number" step="0.01" className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Unit
              <input name="unit" maxLength={30} placeholder="mg" className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Frequency
              <input name="frequency" maxLength={100} placeholder="Daily" className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Started
            <input name="startedAt" type="date" className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Notes
            <textarea name="notes" rows={2} maxLength={1000} className="resize-none rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
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
