import { z } from "zod";

export const goalCategorySchema = z.enum([
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
]);

// UI-facing shapes (lower_snake_case), matching the existing types/health.ts
// conventions — lib/services/goal.service.ts converts these to the DB's
// SCREAMING_CASE enums.
export const goalKindSchema = z.enum(["long_term", "supporting", "project"]);
export const goalPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export const goalStatusSchema = z.enum(["on_track", "attention", "preparation", "completed", "abandoned"]);
export const bodySystemSchema = z.enum([
  "brain",
  "cardiovascular",
  "lungs",
  "liver",
  "gut",
  "kidneys",
  "metabolic",
  "musculoskeletal",
  "immune",
]);

export const createGoalSchema = z.object({
  title: z.string().trim().min(1, "Give the goal a title.").max(150),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  category: goalCategorySchema,
  kind: goalKindSchema.default("supporting"),
  priority: goalPrioritySchema.default("MEDIUM"),
  status: goalStatusSchema.default("on_track"),
  progress: z.coerce.number().int().min(0).max(100).optional(),
  startDate: z.coerce.date().optional(),
  targetDate: z.coerce.date().optional(),
  bodySystems: z.array(bodySystemSchema).default([]),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
