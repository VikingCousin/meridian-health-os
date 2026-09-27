import { Insight } from "@/types/health";

export const insights: Insight[] = [
  {
    id: "ins-1",
    title: "HRV has softened over the past week",
    explanation:
      "Your HRV averaged 51ms this week, down from a 30-day baseline of 55ms. This followed three nights under 6.5 hours of sleep.",
    confidence: "moderate_evidence",
    sourceTypes: ["wearable"],
    relatedSystem: "cardiovascular",
    exploreHref: "/body/cardiovascular#hrv",
    createdAt: "2026-09-06",
  },
  {
    id: "ins-2",
    title: "Possible link between late meals and poorer sleep",
    explanation:
      "On the 4 nights you journaled a large meal within 3 hours of bed, sleep score averaged 14 points lower than nights without one.",
    confidence: "possible_pattern",
    sourceTypes: ["journal", "wearable"],
    relatedSystem: "brain",
    exploreHref: "/experiments",
    createdAt: "2026-09-04",
  },
  {
    id: "ins-3",
    title: "ApoB improved since your last lab test",
    explanation:
      "ApoB decreased from 82 to 74 mg/dL, now comfortably under your personal target of 80 mg/dL and trending down for four consecutive tests.",
    confidence: "strong_pattern",
    sourceTypes: ["lab"],
    relatedSystem: "cardiovascular",
    exploreHref: "/body/cardiovascular",
    createdAt: "2026-08-22",
  },
  {
    id: "ins-4",
    title: "Training adherence dips after short sleep",
    explanation:
      "In the last 8 weeks, planned sessions were skipped or shortened on 6 of 9 mornings that followed under 6.5 hours of sleep.",
    confidence: "moderate_evidence",
    sourceTypes: ["wearable", "journal"],
    relatedSystem: "musculoskeletal",
    exploreHref: "/timeline?filter=training",
    createdAt: "2026-09-01",
  },
  {
    id: "ins-5",
    title: "Digestive symptoms mentioned 4 times this month",
    explanation:
      "Journal entries referencing bloating or discomfort appeared 4 times in the last 30 days, more often on days following Judo evenings.",
    confidence: "early_observation",
    sourceTypes: ["journal"],
    relatedSystem: "gut",
    exploreHref: "/body/gut",
    createdAt: "2026-08-30",
  },
  {
    id: "ins-6",
    title: "Resting heart rate at a 6-month low",
    explanation:
      "Resting HR has fallen from 58 to 54 bpm since May, consistent with rising Zone 2 training volume.",
    confidence: "strong_pattern",
    sourceTypes: ["wearable"],
    relatedSystem: "cardiovascular",
    exploreHref: "/body/cardiovascular#resting-hr",
    createdAt: "2026-08-28",
  },
];
