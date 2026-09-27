import * as healthModeRepo from "@/lib/db/repositories/health-mode.repository";
import type { CoachModeContext } from "@/lib/coach/types";

interface PriorityModifierShape {
  boostCategories?: string[];
  suppressCategories?: string[];
}

export async function listActiveHealthModes(): Promise<CoachModeContext[]> {
  const modes = await healthModeRepo.listActiveHealthModes();
  return modes.map((m) => {
    const modifier = (m.priorityModifier ?? {}) as PriorityModifierShape;
    return {
      id: m.id,
      title: m.title,
      type: m.type,
      boostCategories: modifier.boostCategories ?? [],
      suppressCategories: modifier.suppressCategories ?? [],
    };
  });
}

export async function listAllHealthModes() {
  return healthModeRepo.listHealthModes();
}
