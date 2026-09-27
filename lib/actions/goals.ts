"use server";

import { revalidatePath } from "next/cache";
import { createGoal as createGoalService } from "@/lib/services/goal.service";
import { createGoalSchema } from "@/lib/validation/goal";

export async function createGoalAction(input: unknown) {
  const parsed = createGoalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid goal." };
  }

  const goal = await createGoalService(parsed.data);
  revalidatePath("/goals");
  revalidatePath("/timeline");
  revalidatePath("/");
  return { ok: true as const, goal };
}
