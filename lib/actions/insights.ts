"use server";

import { revalidatePath } from "next/cache";
import { analyzeHealthData } from "@/lib/analytics/health-analysis.service";
import { dismissInsight } from "@/lib/services/insight.service";

export async function runAnalysisAction() {
  const summary = await analyzeHealthData();
  revalidatePath("/insights");
  revalidatePath("/");
  revalidatePath("/body", "layout");
  return { ok: true as const, summary };
}

export async function dismissInsightAction(id: string) {
  await dismissInsight(id);
  revalidatePath("/insights");
  revalidatePath("/");
  revalidatePath("/body", "layout");
  return { ok: true as const };
}
