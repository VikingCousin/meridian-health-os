import { z } from "zod";

export const manualMeasurementSchema = z.object({
  biomarkerDefinitionId: z.string().trim().min(1, "Choose a biomarker."),
  value: z.coerce.number().finite("Enter a valid number."),
  unit: z.string().trim().min(1, "Unit is required.").max(30),
  measuredAt: z.coerce.date(),
});
