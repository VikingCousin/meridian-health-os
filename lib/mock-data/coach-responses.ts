export interface CoachReference {
  label: string;
  href: string;
}

export interface CoachResponse {
  text: string;
  references?: CoachReference[];
}

export const starterQuestions = [
  "What are currently my three biggest health priorities?",
  "How has my sleep changed during the last month?",
  "Explain my ApoB trend.",
  "Do you see patterns between my journal and wearable data?",
  "What should I focus on today?",
  "How am I progressing toward my longevity goals?",
];

const RULES: { match: RegExp; response: CoachResponse }[] = [
  {
    match: /three biggest|top.*priorit|biggest.*priorit/i,
    response: {
      text:
        "Based on your recent data, I'd focus on: 1) Sleep consistency — your sleep score has dipped 5% below baseline this week. 2) Zone 2 volume — you're at 118 of 150 weekly minutes. 3) Gut data freshness — your last stool panel was 4 months ago, so that view is running on stale data.",
      references: [
        { label: "View sleep trend", href: "/body/brain" },
        { label: "View training progress", href: "/body/musculoskeletal" },
        { label: "View gut health", href: "/body/gut" },
      ],
    },
  },
  {
    match: /sleep.*(chang|last month|trend)/i,
    response: {
      text:
        "Your sleep score has averaged 81/100 over the last 7 days, about 5% below your 30-day baseline of 85. Deep sleep is down 15%, largely on nights following late meals or high-intensity Judo sessions.",
      references: [{ label: "View sleep detail", href: "/body/brain" }],
    },
  },
  {
    match: /apob/i,
    response: {
      text:
        "Your ApoB has dropped from 82 to 74 mg/dL since your last panel, a 9.8% decrease and your fourth consecutive test trending downward. You're now under your personal target of 80 mg/dL.",
      references: [{ label: "View ApoB history", href: "/profile/biomarker/apob" }],
    },
  },
  {
    match: /pattern.*(journal|wearable)|journal.*pattern/i,
    response: {
      text:
        "Yes — on nights you journaled a large meal within 3 hours of bed, your sleep score averaged 14 points lower the next morning. This is currently a possible pattern, not a confirmed cause, and worth testing directly.",
      references: [{ label: "View experiment", href: "/experiments" }],
    },
  },
  {
    match: /focus.*today|today.*focus/i,
    response: {
      text:
        "Recovery is running below your baseline today, so I'd prioritize sleep tonight over an intense session. If you do train, Zone 2 rather than high-intensity Judo would fit your current recovery state better.",
      references: [{ label: "See today's priorities", href: "/" }],
    },
  },
  {
    match: /longevity|healthspan/i,
    response: {
      text:
        "You're trending well: ApoB, VO2max, and resting HR are all moving in favorable directions. Sleep consistency is the one supporting goal currently marked as needing attention.",
      references: [{ label: "View goals", href: "/goals" }],
    },
  },
];

export function getCoachResponse(question: string): CoachResponse {
  for (const rule of RULES) {
    if (rule.match.test(question)) return rule.response;
  }
  return {
    text:
      "I can help explore that using your health history — biomarkers, wearable trends, training, and journal entries. Try asking about a specific metric, or pick one of the suggested questions to get started.",
  };
}
