import type { CoachContext, InterventionCandidate } from "@/lib/coach/types";

export interface ConflictFinding {
  interventionId: string;
  caution: string;
  penalty: number;
}

/**
 * Simple, explicit product-level conflict awareness — NOT a medical rules
 * engine (see docs/COACH_ARCHITECTURE.md, "Conflicts"). Every rule here is a
 * hand-authored pair, not a general inference; when a conflict is uncertain,
 * this returns a caution (a small score penalty + a shown note), never a hard
 * block.
 */
export function detectConflicts(candidates: InterventionCandidate[], context: CoachContext): ConflictFinding[] {
  const findings: ConflictFinding[] = [];
  const ids = new Set(candidates.map((c) => c.intervention.id));
  const illnessRecoveryActive = context.currentModes.some((m) => m.type === "ILLNESS_RECOVERY");

  if (illnessRecoveryActive) {
    for (const highDemandId of ["vo2max-intervals", "strength-training"]) {
      if (ids.has(highDemandId)) {
        findings.push({
          interventionId: highDemandId,
          caution: "You're currently in an illness-recovery mode — consider deferring higher-intensity training until you're clear of symptoms.",
          penalty: -12,
        });
      }
    }
  }

  if (ids.has("cold-exposure") && ids.has("strength-training")) {
    findings.push({
      interventionId: "cold-exposure",
      caution: "Cold exposure done immediately after a strength session may blunt muscle-building adaptations — consider spacing them apart.",
      penalty: -6,
    });
  }

  return findings;
}
