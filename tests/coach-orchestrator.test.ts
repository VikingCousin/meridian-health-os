import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { buildCoachContext } from "@/lib/coach/context-builder.service";
import { askCoach, computeWeeklyPriorities } from "@/lib/coach/coach-orchestrator.service";
import { acceptPriority, dismissPriority, getCurrentFocus, listActivePriorities } from "@/lib/services/coach-priority.service";

const MARKER = "TEST_COACH_ORCH";

describe("coach context builder (DB-wired)", () => {
  let goalId: string;

  beforeAll(async () => {
    const goal = await prisma.goal.create({
      data: { title: `${MARKER}_Sleep`, description: "test goal", category: "SLEEP", kind: "SUPPORTING", priority: "MEDIUM", status: "ON_TRACK" },
    });
    goalId = goal.id;
  });

  afterAll(async () => {
    await prisma.goal.deleteMany({ where: { id: goalId } });
  });

  it("includes a real active goal in context, with its category preserved for matching", async () => {
    const context = await buildCoachContext({ intent: "general" });
    const found = context.activeGoals.find((g) => g.id === goalId);
    expect(found).toBeDefined();
    expect(found!.category).toBe("SLEEP");
  });

  it("excludes completed/abandoned goals from the active set", async () => {
    const completedGoal = await prisma.goal.create({
      data: { title: `${MARKER}_Done`, category: "OTHER", kind: "SUPPORTING", priority: "LOW", status: "COMPLETED" },
    });
    try {
      const context = await buildCoachContext({ intent: "general" });
      expect(context.activeGoals.some((g) => g.id === completedGoal.id)).toBe(false);
    } finally {
      await prisma.goal.delete({ where: { id: completedGoal.id } });
    }
  });
});

describe("askCoach (DB-wired, deterministic-only — AI unconfigured in test env)", () => {
  it("produces at most 3 priorities from real context, with safety classified as non-urgent", async () => {
    const response = await askCoach("What should I focus on this week?");
    expect(response.priorities.length).toBeLessThanOrEqual(3);
    expect(response.safety.classification).not.toBe("URGENT_MEDICAL_ATTENTION");
    expect(response.aiGenerated).toBe(false); // no AI_PROVIDER configured in the test environment
  });

  it("short-circuits before computing any priorities for an urgent-symptom question", async () => {
    const response = await askCoach("I have severe chest pain right now");
    expect(response.safety.classification).toBe("URGENT_MEDICAL_ATTENTION");
    expect(response.priorities).toHaveLength(0);
    expect(response.summary).toContain("urgent");
  });

  it("short-circuits for a medication-change question without silently answering something else", async () => {
    const response = await askCoach("should I stop taking my medication");
    expect(response.safety.classification).toBe("MEDICAL_REVIEW_RECOMMENDED");
    expect(response.priorities).toHaveLength(0);
    expect(response.summary.toLowerCase()).toContain("doctor");
  });

  it("suggests testing rather than assuming when the top priority's evidence is weak", async () => {
    const weekly = await computeWeeklyPriorities();
    const response = await askCoach("What should I focus on this week?");
    if (weekly.length > 0) {
      const primary = weekly[0];
      const weakEvidence = primary.evidenceLevel === "EMERGING" || primary.evidenceLevel === "PERSONAL_EXPERIMENT" || primary.evidenceLevel === "UNKNOWN";
      const earlyPattern = primary.confidence === "low";
      if (weakEvidence || earlyPattern) {
        expect(response.suggestedExperiment).toBeDefined();
      }
    }
  });
});

describe("coach priority acceptance / dismissal (DB-wired persistence)", () => {
  let acceptedId: string | undefined;

  afterAll(async () => {
    if (acceptedId) await prisma.coachPriority.deleteMany({ where: { id: acceptedId } });
  });

  it("does not create a CoachPriority row until explicitly accepted", async () => {
    const before = await prisma.coachPriority.count({ where: { title: `${MARKER}_Priority` } });
    expect(before).toBe(0);
  });

  it("persists an accepted priority and surfaces it via getCurrentFocus", async () => {
    const accepted = await acceptPriority({
      interventionId: "hydration",
      title: `${MARKER}_Priority`,
      tier: "primary",
      score: 55,
      why: "test reason",
      linkedGoalIds: [],
      linkedInsightIds: [],
      linkedMetricKeys: [],
      confidence: "moderate",
      burden: "LOW",
      cautions: [],
      requiresMedicalReview: false,
    });
    acceptedId = accepted.id;
    expect(accepted.status).toBe("accepted");

    const active = await listActivePriorities();
    expect(active.some((p) => p.id === accepted.id)).toBe(true);

    const focus = await getCurrentFocus(3);
    expect(focus.some((f) => f.persistedId === accepted.id)).toBe(true);
  });

  it("does not duplicate an already-accepted intervention on re-acceptance", async () => {
    const again = await acceptPriority({
      interventionId: "hydration",
      title: `${MARKER}_Priority`,
      tier: "primary",
      score: 55,
      why: "test reason",
      linkedGoalIds: [],
      linkedInsightIds: [],
      linkedMetricKeys: [],
      confidence: "moderate",
      burden: "LOW",
      cautions: [],
      requiresMedicalReview: false,
    });
    expect(again.id).toBe(acceptedId);
    const count = await prisma.coachPriority.count({ where: { interventionDefinitionId: "hydration", status: { in: ["ACCEPTED", "ACTIVE"] } } });
    expect(count).toBe(1);
  });

  it("removes a dismissed priority from the active/current-focus set", async () => {
    await dismissPriority(acceptedId!);
    const active = await listActivePriorities();
    expect(active.some((p) => p.id === acceptedId)).toBe(false);

    const row = await prisma.coachPriority.findUniqueOrThrow({ where: { id: acceptedId! } });
    expect(row.status).toBe("DISMISSED");
    expect(row.endedAt).not.toBeNull();
  });
});
