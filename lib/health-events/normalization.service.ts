import { prisma } from "@/lib/db/prisma";
import * as normalizedEventRepo from "@/lib/db/repositories/normalized-event.repository";
import type { NormalizedEventType, ObservationType } from "@/lib/generated/prisma/client";

interface NormalizationRule {
  observationType: ObservationType;
  matches: RegExp;
  eventType: NormalizedEventType;
}

// A deliberately bounded, explicit mapping from already-structured journal
// observations to the canonical event taxonomy. This is NOT a classifier and
// makes NO LLM call — the observation already carries a type + normalized
// label (from either the keyword tagger or the AI journal extractor), so a
// second AI pass would add cost and non-determinism without adding
// information. Order matters: the first matching rule wins, so more specific
// patterns are listed before their catch-alls.
const RULES: NormalizationRule[] = [
  { observationType: "FOOD", matches: /late/i, eventType: "LATE_MEAL" },
  { observationType: "FOOD", matches: /large/i, eventType: "LARGE_MEAL" },
  { observationType: "ALCOHOL", matches: /.+/, eventType: "ALCOHOL" },
  { observationType: "CAFFEINE", matches: /late|evening|afternoon/i, eventType: "CAFFEINE_LATE" },
  { observationType: "LIFESTYLE", matches: /sauna/i, eventType: "SAUNA" },
  { observationType: "LIFESTYLE", matches: /cold plunge|cold exposure|ice bath/i, eventType: "COLD_EXPOSURE" },
  { observationType: "LIFESTYLE", matches: /breathwork|breathing exercise/i, eventType: "BREATHWORK" },
  { observationType: "TRAINING", matches: /judo/i, eventType: "JUDO" },
  { observationType: "TRAINING", matches: /strength|lift|weights?/i, eventType: "STRENGTH_TRAINING" },
  { observationType: "TRAINING", matches: /zone.?2/i, eventType: "ZONE2" },
  { observationType: "TRAINING", matches: /high.?intensity|hiit|sprint/i, eventType: "HIGH_INTENSITY" },
  { observationType: "SLEEP", matches: /poor sleep|interruption|restless|woke/i, eventType: "POOR_SLEEP_SUBJECTIVE" },
  { observationType: "ENERGY", matches: /fatigue|low energy|exhaust/i, eventType: "LOW_ENERGY" },
  { observationType: "ENERGY", matches: /high energy|energetic/i, eventType: "HIGH_ENERGY" },
  { observationType: "STRESS", matches: /stress|anxious|overwhelm/i, eventType: "HIGH_STRESS" },
  { observationType: "MOOD", matches: /low mood|low motivation|down/i, eventType: "LOW_MOOD" },
  { observationType: "PAIN", matches: /.+/, eventType: "PAIN" },
  { observationType: "SYMPTOM", matches: /illness|sick|fever|flu/i, eventType: "ILLNESS" },
  { observationType: "SUPPLEMENT", matches: /start/i, eventType: "SUPPLEMENT_STARTED" },
  { observationType: "SUPPLEMENT", matches: /stop|discontinu/i, eventType: "SUPPLEMENT_STOPPED" },
];

/**
 * Deterministically maps one JournalObservation to a canonical event type, or
 * `null` if no rule matches with confidence. Per the Phase 4 spec: "if
 * uncertain, do not normalize — it is better to miss an event than create a
 * false one." There is no fallback/catch-all bucket.
 */
export function classifyObservation(observationType: ObservationType, text: string): NormalizedEventType | null {
  const rule = RULES.find((r) => r.observationType === observationType && r.matches.test(text));
  return rule?.eventType ?? null;
}

/**
 * Normalizes every JournalObservation into a NormalizedHealthEvent, skipping
 * ones that already have a corresponding event (upsert is idempotent per
 * source) or that don't confidently classify. Safe to re-run at any time —
 * it never mutates or deletes the original JournalObservation.
 */
export async function normalizePendingObservations(): Promise<{ created: number; skipped: number }> {
  const observations = await prisma.journalObservation.findMany({
    include: { journalEntry: true },
  });

  let created = 0;
  let skipped = 0;

  for (const obs of observations) {
    const eventType = classifyObservation(obs.type, obs.normalizedValue ?? obs.label);
    if (!eventType) {
      skipped++;
      continue;
    }
    await normalizedEventRepo.upsertNormalizedEvent({
      type: eventType,
      occurredAt: obs.journalEntry.entryDate,
      sourceType: "JOURNAL_OBSERVATION",
      sourceId: obs.id,
      confidence: obs.confidence ?? undefined,
      metadata: { label: obs.label, normalizedValue: obs.normalizedValue, journalEntryId: obs.journalEntryId },
    });
    created++;
  }

  return { created, skipped };
}
