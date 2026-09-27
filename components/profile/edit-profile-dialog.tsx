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
import { updateProfileAction } from "@/lib/actions/profile";
import { Pencil, XCircle } from "lucide-react";
import type { UserProfile } from "@/lib/generated/prisma/client";
import { format } from "date-fns";

export function EditProfileDialog({ profile }: { profile: UserProfile }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await updateProfileAction({
        firstName: formData.get("firstName"),
        lastName: formData.get("lastName") || undefined,
        dateOfBirth: formData.get("dateOfBirth"),
        biologicalSex: formData.get("biologicalSex") || undefined,
        heightCm: formData.get("heightCm"),
        currentWeightKg: formData.get("currentWeightKg") || undefined,
        timezone: formData.get("timezone"),
        occupation: formData.get("occupation") || undefined,
        activityLevel: formData.get("activityLevel") || undefined,
        generalHealthNotes: formData.get("generalHealthNotes") || undefined,
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
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>Basic information used across your health profile.</DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="mt-4 flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              First name
              <input name="firstName" required defaultValue={profile.firstName} maxLength={80} className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Last name
              <input name="lastName" defaultValue={profile.lastName ?? ""} maxLength={80} className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Date of birth
              <input
                name="dateOfBirth"
                type="date"
                required
                defaultValue={format(profile.dateOfBirth, "yyyy-MM-dd")}
                className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Biological sex
              <select name="biologicalSex" defaultValue={profile.biologicalSex ?? ""} className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
                <option value="">Prefer not to say</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Height (cm)
              <input name="heightCm" type="number" step="0.1" required defaultValue={profile.heightCm} className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Weight (kg)
              <input name="currentWeightKg" type="number" step="0.1" defaultValue={profile.currentWeightKg ?? ""} className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Timezone
            <input name="timezone" required defaultValue={profile.timezone} maxLength={80} className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Occupation
              <input name="occupation" defaultValue={profile.occupation ?? ""} maxLength={120} className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Activity level
              <select name="activityLevel" defaultValue={profile.activityLevel ?? ""} className="rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
                <option value="">Not set</option>
                <option value="SEDENTARY">Sedentary</option>
                <option value="LIGHTLY_ACTIVE">Lightly active</option>
                <option value="MODERATELY_ACTIVE">Moderately active</option>
                <option value="VERY_ACTIVE">Very active</option>
                <option value="ATHLETE">Athlete</option>
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            General health notes
            <textarea name="generalHealthNotes" rows={2} defaultValue={profile.generalHealthNotes ?? ""} maxLength={2000} className="resize-none rounded-lg border border-border-soft bg-surface-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </label>
          {error && (
            <p className="flex items-center gap-1.5 text-[13px] text-danger">
              <XCircle className="h-3.5 w-3.5" /> {error}
            </p>
          )}
          <Button type="submit" disabled={isPending} className="mt-1">
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
