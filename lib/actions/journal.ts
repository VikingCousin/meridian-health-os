"use server";

import { revalidatePath } from "next/cache";
import { createJournalEntryWithAnalysis } from "@/lib/services/journal.service";
import { createJournalEntrySchema } from "@/lib/validation/journal";

export async function createJournalEntryAction(input: { text: string }) {
  const parsed = createJournalEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid entry." };
  }

  const entry = await createJournalEntryWithAnalysis(parsed.data.text, parsed.data.entryDate);
  revalidatePath("/journal");
  revalidatePath("/timeline");
  revalidatePath("/");
  return { ok: true as const, entry };
}
