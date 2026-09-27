import { z } from "zod";

export const experimentStatusSchema = z.enum(["PLANNED", "ACTIVE", "COMPLETED", "ABANDONED"]);
export const outcomeMetricTypeSchema = z.enum(["BIOMARKER", "JOURNAL_OBSERVATION", "SUBJECTIVE_RATING", "OTHER"]);

export const createExperimentSchema = z
  .object({
    title: z.string().trim().min(1, "Give the experiment a title.").max(150),
    hypothesis: z.string().trim().min(1, "What do you expect to happen?").max(500),
    protocol: z.string().trim().min(1, "Describe the protocol.").max(500),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    status: experimentStatusSchema.default("PLANNED"),
    notes: z.string().trim().max(1000).optional().or(z.literal("")),
    outcomes: z
      .array(
        z.object({
          metricType: outcomeMetricTypeSchema,
          metricReference: z.string().trim().max(100).optional(),
          label: z.string().trim().min(1).max(120),
        })
      )
      .min(1, "Track at least one outcome."),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "End date must be after the start date.",
    path: ["endDate"],
  });

export type CreateExperimentInput = z.infer<typeof createExperimentSchema>;
