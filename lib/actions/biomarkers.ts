"use server";

import { revalidatePath } from "next/cache";
import { createManualMeasurement } from "@/lib/services/biomarker.service";
import { manualMeasurementSchema } from "@/lib/validation/biomarker";

export async function addManualMeasurementAction(input: unknown) {
  const parsed = manualMeasurementSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid value." };
  }

  await createManualMeasurement(parsed.data);

  revalidatePath("/profile");
  revalidatePath("/timeline");
  revalidatePath("/body");
  revalidatePath("/");

  return { ok: true as const };
}
