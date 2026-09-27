import { z } from "zod";

export const createJournalEntrySchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Write something before saving.")
    .max(5000, "That entry is a bit long — try splitting it up."),
  entryDate: z.coerce.date().optional(),
});

export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;
