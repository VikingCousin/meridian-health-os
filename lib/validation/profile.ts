import { z } from "zod";

export const biologicalSexSchema = z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]);
export const activityLevelSchema = z.enum([
  "SEDENTARY",
  "LIGHTLY_ACTIVE",
  "MODERATELY_ACTIVE",
  "VERY_ACTIVE",
  "ATHLETE",
]);

export const profileFormSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().max(80).optional().or(z.literal("")),
  dateOfBirth: z.coerce.date().max(new Date(), "Date of birth can't be in the future"),
  biologicalSex: biologicalSexSchema.optional(),
  heightCm: z.coerce.number().positive().max(300),
  currentWeightKg: z.coerce.number().positive().max(400).optional(),
  timezone: z.string().trim().min(1).max(80),
  occupation: z.string().trim().max(120).optional().or(z.literal("")),
  activityLevel: activityLevelSchema.optional(),
  generalHealthNotes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type ProfileFormInput = z.infer<typeof profileFormSchema>;

export const medicalHistoryFormSchema = z.object({
  condition: z.string().trim().min(1).max(200),
  diagnosisDate: z.coerce.date().optional(),
  status: z.enum(["ACTIVE", "MANAGED", "RESOLVED", "SUSPECTED", "HISTORICAL"]).default("ACTIVE"),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  source: z
    .enum(["SELF_REPORTED", "DOCTOR_DIAGNOSED", "DOCUMENT_IMPORTED", "AI_EXTRACTED", "OTHER"])
    .default("SELF_REPORTED"),
});

export const medicationFormSchema = z.object({
  name: z.string().trim().min(1).max(150),
  dose: z.coerce.number().positive().optional(),
  unit: z.string().trim().max(30).optional().or(z.literal("")),
  frequency: z.string().trim().max(100).optional().or(z.literal("")),
  startedAt: z.coerce.date().optional(),
  stoppedAt: z.coerce.date().optional(),
  active: z.coerce.boolean().default(true),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const supplementFormSchema = medicationFormSchema.extend({
  productName: z.string().trim().max(150).optional().or(z.literal("")),
});
