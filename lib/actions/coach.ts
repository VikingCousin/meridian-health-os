"use server";

import { revalidatePath } from "next/cache";
import { askCoach } from "@/lib/coach/coach-orchestrator.service";
import { acceptPriority, dismissPriority } from "@/lib/services/coach-priority.service";
import { askCoachSchema } from "@/lib/validation/coach";
import type { PriorityCardData } from "@/lib/coach/types";

export async function askCoachAction(input: unknown) {
  const parsed = askCoachSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Ask something first." };
  }
  const response = await askCoach(parsed.data.question);
  return { ok: true as const, response };
}

export async function acceptCoachPriorityAction(priority: PriorityCardData) {
  const accepted = await acceptPriority(priority);
  revalidatePath("/");
  revalidatePath("/coach/plan");
  revalidatePath("/goals");
  revalidatePath("/body", "layout");
  return { ok: true as const, priority: accepted };
}

export async function dismissCoachPriorityAction(id: string) {
  await dismissPriority(id);
  revalidatePath("/");
  revalidatePath("/coach/plan");
  revalidatePath("/goals");
  revalidatePath("/body", "layout");
  return { ok: true as const };
}
