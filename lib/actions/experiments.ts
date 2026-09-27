"use server";

import { revalidatePath } from "next/cache";
import { createExperiment as createExperimentService } from "@/lib/services/experiment.service";
import { createExperimentSchema } from "@/lib/validation/experiment";

export async function createExperimentAction(input: unknown) {
  const parsed = createExperimentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid experiment." };
  }

  const experiment = await createExperimentService(parsed.data);
  revalidatePath("/experiments");
  revalidatePath("/timeline");
  return { ok: true as const, experiment };
}
