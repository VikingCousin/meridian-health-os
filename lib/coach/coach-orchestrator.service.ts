import { classifySafety } from "@/lib/coach/safety.service";
import { classifyIntent } from "@/lib/coach/intent-router.service";
import { buildCoachContext } from "@/lib/coach/context-builder.service";
import { generateCandidates } from "@/lib/coach/candidate-generation.service";
import { scoreCandidates, selectTopPriorities, tierFor } from "@/lib/coach/prioritization.service";
import { generateCoachLanguage } from "@/lib/coach/language.service";
import { getHealthKnowledgeProvider } from "@/lib/coach/knowledge-provider";
import { getServerLocale } from "@/lib/i18n/server";
import type { CoachContext, CoachEvidenceItem, CoachPriorityView, CoachResponse, ScoredCandidate } from "@/lib/coach/types";
import type { ConfidenceLevel } from "@/types/health";

const INSIGHT_CONFIDENCE_TO_WORD: Record<ConfidenceLevel, "low" | "moderate" | "high"> = {
  early_observation: "low",
  possible_pattern: "low",
  moderate_evidence: "moderate",
  strong_pattern: "high",
};

const EVIDENCE_LEVEL_TO_WORD: Record<string, "low" | "moderate" | "high"> = {
  ESTABLISHED: "high",
  MODERATE: "moderate",
  EMERGING: "low",
  PERSONAL_EXPERIMENT: "low",
  UNKNOWN: "low",
};

function toPriorityView(scored: ScoredCandidate, index: number): CoachPriorityView {
  const { candidate } = scored;
  const confidence =
    candidate.reasonType === "personal_pattern" && candidate.linkedInsightConfidenceLevel
      ? INSIGHT_CONFIDENCE_TO_WORD[candidate.linkedInsightConfidenceLevel]
      : (EVIDENCE_LEVEL_TO_WORD[candidate.intervention.evidenceLevel] ?? "low");

  return {
    interventionId: candidate.intervention.id,
    title: candidate.intervention.title,
    tier: tierFor(index),
    score: scored.totalScore,
    breakdown: scored.breakdown,
    why: candidate.reasonText,
    linkedGoalIds: candidate.linkedGoalIds,
    linkedInsightIds: candidate.linkedInsightIds,
    linkedMetricKeys: candidate.intervention.measurementOptions,
    confidence,
    burden: candidate.intervention.burden,
    cautions: scored.cautions,
    evidenceLevel: candidate.intervention.evidenceLevel,
    requiresMedicalReview: candidate.intervention.requiresMedicalReview,
  };
}

// Never the whole library — retrieved locally, capped small, and each result
// keeps its document/source citation (see docs/KNOWLEDGE_ARCHITECTURE.md,
// "Coach integration"). A search miss falls back to the Phase 6 static note
// so an intervention without a matching document still gets a one-liner.
const MAX_GENERAL_KNOWLEDGE_ITEMS = 4;

async function buildEvidenceItems(question: string, context: CoachContext, priorities: CoachPriorityView[]): Promise<CoachEvidenceItem[]> {
  const items: CoachEvidenceItem[] = [];
  const knowledge = getHealthKnowledgeProvider();

  for (const metric of context.relevantBiomarkers.slice(0, 3)) {
    items.push({
      kind: "your_data",
      text: `${metric.name}: ${metric.currentValue}${metric.unit}${metric.changePct !== undefined ? ` (${metric.changePct > 0 ? "+" : ""}${metric.changePct.toFixed(0)}%)` : ""}`,
      href: `/profile/biomarker/${metric.key}`,
    });
  }

  const linkedInsightIds = new Set(priorities.flatMap((p) => p.linkedInsightIds));
  for (const insight of context.recentInsights) {
    if (!linkedInsightIds.has(insight.id)) continue;
    items.push({ kind: "personal_pattern", text: insight.summary, href: `/insights/${insight.id}`, confidence: INSIGHT_CONFIDENCE_TO_WORD[insight.confidence] });
  }

  let knowledgeCount = 0;
  for (const priority of priorities) {
    if (knowledgeCount < MAX_GENERAL_KNOWLEDGE_ITEMS) {
      const results = await knowledge.search({ text: `${priority.title} ${question}`, limit: 1 });
      const match = results[0];
      if (match) {
        items.push({
          kind: "general_knowledge",
          text: `${match.content} [Source: ${match.documentTitle}${match.sourceName ? ` — ${match.sourceName}` : ""}]`,
          href: `/knowledge/${match.documentId}`,
        });
        knowledgeCount++;
      } else {
        const note = knowledge.getNote(priority.interventionId);
        if (note) {
          items.push({ kind: "general_knowledge", text: note });
          knowledgeCount++;
        }
      }
    }
    if (priority.requiresMedicalReview) items.push({ kind: "medical_followup", text: `${priority.title} — worth discussing with your physician.` });
  }

  return items;
}

function buildUncertainties(context: CoachContext, priorities: CoachPriorityView[]): string[] {
  const notes = ["This is a product-priority score, not a measure of medical probability or clinical efficacy."];
  for (const p of priorities) {
    if (p.evidenceLevel === "EMERGING" || p.evidenceLevel === "PERSONAL_EXPERIMENT" || p.evidenceLevel === "UNKNOWN") {
      notes.push(`Evidence for "${p.title}" is ${p.evidenceLevel === "UNKNOWN" ? "not well characterized" : p.evidenceLevel.toLowerCase()} rather than established — worth testing rather than assuming.`);
    }
    for (const caution of p.cautions) notes.push(caution);
  }
  notes.push(...context.dataQuality.notes);
  return [...new Set(notes)];
}

function pickSuggestedExperiment(top: ScoredCandidate[]): CoachResponse["suggestedExperiment"] {
  if (top.length === 0) return undefined;
  const primary = top[0].candidate;
  const weakEvidence = primary.intervention.evidenceLevel === "EMERGING" || primary.intervention.evidenceLevel === "PERSONAL_EXPERIMENT" || primary.intervention.evidenceLevel === "UNKNOWN";
  const earlyPattern = primary.linkedInsightConfidenceLevel === "early_observation" || primary.linkedInsightConfidenceLevel === "possible_pattern";
  if (weakEvidence || earlyPattern) return { interventionId: primary.intervention.id, title: primary.intervention.title };
  return undefined;
}

/**
 * The deterministic core only — context, candidates, scoring, top-3 — with
 * no LLM call and no safety-driven short-circuit (there's no free-text
 * question to classify). Used for surfaces that show "current focus"
 * without a chat framing: /coach/plan, Home, Body. This is exactly what
 * keeps the Coach useful with zero AI configuration — see
 * docs/COACH_ARCHITECTURE.md, "Coach without AI."
 */
export async function computeWeeklyPriorities(): Promise<CoachPriorityView[]> {
  const context = await buildCoachContext({ intent: "weekly_focus" });
  const candidates = generateCandidates(context);
  const scored = scoreCandidates(candidates, context);
  const top = selectTopPriorities(scored);
  return top.map((s, i) => toPriorityView(s, i));
}

/**
 * The full pipeline: USER REQUEST -> context builder -> deterministic
 * prioritization -> safety filter -> optional LLM phrasing -> traceable
 * response. Safety runs first and is never overridden by anything
 * downstream — see docs/COACH_ARCHITECTURE.md.
 */
export async function askCoach(question: string): Promise<CoachResponse> {
  const safety = classifySafety(question);

  // Both higher-risk classifications short-circuit before any prioritization
  // or LLM call runs — the safety message is never diluted with an unrelated
  // "here's what to focus on" answer, and the LLM never gets a chance to
  // soften or override it (see docs/COACH_ARCHITECTURE.md, "Safety layer").
  if (safety.classification === "URGENT_MEDICAL_ATTENTION" || safety.classification === "MEDICAL_REVIEW_RECOMMENDED") {
    return {
      summary: safety.message!,
      observations: [],
      priorities: [],
      evidence: [],
      uncertainties: [],
      safety,
      suggestedFollowUpQuestions: safety.classification === "MEDICAL_REVIEW_RECOMMENDED" ? ["What should I focus on this week?"] : [],
      aiGenerated: false,
    };
  }

  const intent = classifyIntent(question);
  const context = await buildCoachContext(intent);
  const candidates = generateCandidates(context);
  const scored = scoreCandidates(candidates, context);
  const top = selectTopPriorities(scored);
  const priorities = top.map((s, i) => toPriorityView(s, i));

  const locale = await getServerLocale();
  const language = await generateCoachLanguage(question, context, priorities, safety, locale);

  return {
    summary: language.output.summary,
    observations: language.output.observationNotes,
    priorities,
    evidence: await buildEvidenceItems(question, context, priorities),
    uncertainties: buildUncertainties(context, priorities),
    safety,
    suggestedExperiment: pickSuggestedExperiment(top),
    suggestedFollowUpQuestions: language.output.followUpQuestions,
    aiGenerated: language.aiGenerated,
  };
}
