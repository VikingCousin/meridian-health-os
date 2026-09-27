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
import { createGoalAction } from "@/lib/actions/goals";
import { Plus, XCircle } from "lucide-react";

const categories = [
  "LONGEVITY",
  "CARDIOVASCULAR",
  "STRENGTH",
  "AEROBIC",
  "SLEEP",
  "METABOLIC",
  "IMMUNE",
  "MENTAL",
  "HABIT",
  "PERFORMANCE",
  "OTHER",
] as const;

const kinds = [
  { value: "long_term", label: "Long-term goal" },
  { value: "supporting", label: "Supporting goal" },
  { value: "project", label: "Project" },
] as const;

export function NewGoalDialog() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await createGoalAction({
        title: formData.get("title"),
        description: formData.get("description") || undefined,
        category: formData.get("category"),
        kind: formData.get("kind"),
        targetDate: formData.get("targetDate") || undefined,
        progress: formData.get("progress") ? Number(formData.get("progress")) : undefined,
        bodySystems: [],
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
        <Button size="sm">
          <Plus className="h-4 w-4" /> New goal
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New goal</DialogTitle>
          <DialogDescription>Add a supporting goal or a temporary project.</DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Title
            <input name="title" required maxLength={150} className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Description
            <textarea name="description" rows={2} maxLength={1000} className="resize-none rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Kind
              <select name="kind" defaultValue="supporting" className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
                {kinds.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Category
              <select name="category" defaultValue="OTHER" className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0) + c.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Progress (%)
              <input name="progress" type="number" min={0} max={100} className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Target date
              <input name="targetDate" type="date" className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </label>
          </div>
          {error && (
            <p className="flex items-center gap-1.5 text-[13px] text-danger">
              <XCircle className="h-3.5 w-3.5" /> {error}
            </p>
          )}
          <Button type="submit" disabled={isPending} className="mt-1">
            {isPending ? "Saving…" : "Create goal"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
