import type { BodySystemId, SystemStatus } from "@/types/health";
import { listBiomarkersForSystem } from "@/lib/services/biomarker.service";

export interface RealBodySystemStatus {
  status: SystemStatus;
  summary: string;
}

/**
 * Real-mode replacement for the demo dataset's fabricated per-system
 * "status"/"summary" (e.g. "Stable — lipids and heart metrics are within
 * personal targets and improving", shown unconditionally regardless of
 * actual data). This is a plain data-presence fact, never a computed health
 * judgment — no new scoring system, per the V1 hardening constraints.
 */
export async function getRealBodySystemStatus(systemId: BodySystemId): Promise<RealBodySystemStatus> {
  const biomarkers = await listBiomarkersForSystem(systemId);
  if (biomarkers.length === 0) {
    return { status: "needs_data", summary: "No biomarkers logged for this system yet." };
  }
  return { status: "has_data", summary: `${biomarkers.length} biomarker${biomarkers.length === 1 ? "" : "s"} tracked.` };
}
