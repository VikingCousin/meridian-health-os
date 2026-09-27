import type { InterventionDefinition, Level } from "@/lib/coach/intervention-catalog";
import type { HealthInsightStatus, InsightSummaryCard } from "@/types/health";

// ---------------------------------------------------------------------------
// Coach context — the ONLY structured data the deterministic pipeline (and,
// optionally, the LLM) is allowed to reason over. Bounded windows and
// relevance filtering are enforced by the context builder, never left to an
// LLM to decide what to fetch. See docs/COACH_ARCHITECTURE.md.
// ---------------------------------------------------------------------------

export interface CoachGoalContext {
  id: string;
  title: string;
  kind: "long_term" | "supporting" | "project";
  category: string;
  status: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  progress?: number;
  rationale?: string;
}

export interface CoachExperimentContext {
  id: string;
  title: string;
  status: "active" | "completed" | "planned" | "abandoned";
  trackedMetrics: string[];
}

export interface CoachBiomarkerContext {
  key: string;
  name: string;
  currentValue: number;
  unit: string;
  trendDirection: "up" | "down" | "flat";
  changePct?: number;
}

export interface CoachModeContext {
  id: string;
  title: string;
  type: string;
  boostCategories: string[];
  suppressCategories: string[];
}

export interface CoachJournalObservationContext {
  date: string;
  label: string;
  category: string;
}

export interface CoachDataQualityContext {
  overallStatus: "good" | "limited" | "poor";
  notes: string[];
}

export interface CoachSafetyContext {
  medications: string[];
  supplements: string[];
  medicalConditions: string[];
}

export interface CoachContext {
  profileFirstName: string;
  activeGoals: CoachGoalContext[];
  activeExperiments: CoachExperimentContext[];
  recentInsights: InsightSummaryCard[];
  relevantBiomarkers: CoachBiomarkerContext[];
  recentJournalObservations: CoachJournalObservationContext[];
  currentModes: CoachModeContext[];
  dataQuality: CoachDataQualityContext;
  safetyContext: CoachSafetyContext;
}

// ---------------------------------------------------------------------------
// Candidate generation + prioritization
// ---------------------------------------------------------------------------

export type CandidateReasonType = "personal_pattern" | "goal_alignment" | "mode_relevance";

export interface InterventionCandidate {
  intervention: InterventionDefinition;
  reasonType: CandidateReasonType;
  reasonText: string;
  linkedGoalIds: string[];
  linkedInsightIds: string[];
  linkedInsightConfidenceLevel?: InsightSummaryCard["confidence"];
  linkedInsightStatus?: HealthInsightStatus;
}

export interface PriorityScoreBreakdown {
  goalAlignment: number;
  personalEvidence: number;
  expectedImpact: number;
  measurementClarity: number;
  burdenPenalty: number;
  riskPenalty: number;
  conflictPenalty: number;
  modeModifier: number;
  recentExperimentPenalty: number;
  dataQualityPenalty: number;
}

export interface ScoredCandidate {
  candidate: InterventionCandidate;
  totalScore: number;
  breakdown: PriorityScoreBreakdown;
  cautions: string[];
}

export type PriorityTier = "primary" | "secondary" | "optional";

export interface CoachPriorityView {
  interventionId: string;
  title: string;
  tier: PriorityTier;
  score: number;
  breakdown: PriorityScoreBreakdown;
  why: string;
  linkedGoalIds: string[];
  linkedInsightIds: string[];
  linkedMetricKeys: string[];
  confidence: "low" | "moderate" | "high";
  burden: "LOW" | "MEDIUM" | "HIGH";
  cautions: string[];
  evidenceLevel: InterventionDefinition["evidenceLevel"];
  requiresMedicalReview: boolean;
}

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------

export type SafetyClassification = "GENERAL_WELLNESS" | "PERSONAL_HEALTH_CONTEXT" | "MEDICAL_REVIEW_RECOMMENDED" | "URGENT_MEDICAL_ATTENTION";

export interface SafetyResult {
  classification: SafetyClassification;
  reasons: string[];
  /** A fixed, non-LLM-generated message to show for MEDICAL_REVIEW_RECOMMENDED / URGENT_MEDICAL_ATTENTION. */
  message?: string;
}

// ---------------------------------------------------------------------------
// Response contract
// ---------------------------------------------------------------------------

export type EvidenceKind = "your_data" | "personal_pattern" | "general_knowledge" | "experimental_idea" | "medical_followup";

export interface CoachEvidenceItem {
  kind: EvidenceKind;
  text: string;
  href?: string;
  confidence?: "low" | "moderate" | "high";
}

// ---------------------------------------------------------------------------
// Persisted priorities (only ever created by explicit user action — see
// docs/COACH_ARCHITECTURE.md, "User acceptance")
// ---------------------------------------------------------------------------

export type PersistedCoachPriorityStatus = "suggested" | "accepted" | "active" | "completed" | "dismissed";

export interface PersistedCoachPriority {
  id: string;
  interventionId: string;
  title: string;
  status: PersistedCoachPriorityStatus;
  tier: PriorityTier;
  score: number;
  reason: string;
  linkedGoalIds: string[];
  linkedInsightIds: string[];
  linkedMetricKeys: string[];
  startedAt: string;
  confidence: "low" | "moderate" | "high";
  burden: Level;
  requiresMedicalReview: boolean;
}

/** The subset PriorityCard actually renders — satisfied by both a freshly-scored CoachPriorityView and an already-accepted PersistedCoachPriority. */
export interface PriorityCardData {
  interventionId: string;
  title: string;
  tier: PriorityTier;
  score: number;
  why: string;
  linkedGoalIds: string[];
  linkedInsightIds: string[];
  linkedMetricKeys: string[];
  confidence: "low" | "moderate" | "high";
  burden: Level;
  cautions: string[];
  requiresMedicalReview: boolean;
}

/** A single "current focus" item, whichever source it came from — accepted/persisted, or freshly computed. Shared by /coach/plan, Home, and Body's "Current Focus" sections. */
export interface FocusItem {
  /** Present only when this reflects a persisted, user-accepted CoachPriority. */
  persistedId?: string;
  interventionId: string;
  title: string;
  tier: PriorityTier;
  why: string;
  linkedGoalIds: string[];
  linkedInsightIds: string[];
}

export interface CoachResponse {
  summary: string;
  observations: string[];
  priorities: CoachPriorityView[];
  evidence: CoachEvidenceItem[];
  uncertainties: string[];
  safety: SafetyResult;
  suggestedExperiment?: { interventionId: string; title: string };
  suggestedFollowUpQuestions: string[];
  /** True when the summary/observations text came from the LLM rather than the deterministic fallback template. */
  aiGenerated: boolean;
}
