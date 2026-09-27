import { z } from "zod";

// What the LLM is allowed to return: phrasing only. No numbers, no IDs, no
// new priorities — see docs/COACH_ARCHITECTURE.md, "LLM role." Every field
// here is prose the deterministic pipeline decided was safe to have
// explained; the model cannot introduce anything not already in that set.
export const coachLanguageSchema = z.object({
  summary: z.string().trim().min(1).max(600),
  observationNotes: z.array(z.string().trim().max(220)).max(5),
  followUpQuestions: z.array(z.string().trim().max(150)).max(4),
});

export type CoachLanguageOutput = z.infer<typeof coachLanguageSchema>;

export const askCoachSchema = z.object({
  question: z.string().trim().min(1, "Ask something first.").max(500),
});

export type AskCoachInput = z.infer<typeof askCoachSchema>;
