import {
  Home,
  PersonStanding,
  GanttChartSquare,
  NotebookPen,
  Sparkles,
  CircleUserRound,
  Target,
  FlaskConical,
  MoreHorizontal,
  Radar,
  BookOpen,
} from "lucide-react";

// `labelKey`/`descriptionKey` are lib/i18n dictionary paths — resolved via
// useTranslations()/t() in each render site, never a hardcoded string, so
// the whole nav stays translated from one place (see lib/i18n/types.ts).

// Desktop sidebar — full list, there's room for all of it.
export const navItems = [
  { href: "/", labelKey: "nav.home", icon: Home },
  { href: "/body", labelKey: "nav.body", icon: PersonStanding },
  { href: "/knowledge", labelKey: "nav.knowledge", icon: BookOpen },
  { href: "/insights", labelKey: "nav.insights", icon: Radar },
  { href: "/timeline", labelKey: "nav.timeline", icon: GanttChartSquare },
  { href: "/journal", labelKey: "nav.journal", icon: NotebookPen },
  { href: "/coach", labelKey: "nav.coach", icon: Sparkles },
  { href: "/profile", labelKey: "nav.profile", icon: CircleUserRound },
] as const;

// Mobile bottom nav — the 4 highest-frequency destinations plus "More".
export const mobileNavItems = [
  { href: "/", labelKey: "nav.home", icon: Home },
  { href: "/body", labelKey: "nav.body", icon: PersonStanding },
  { href: "/journal", labelKey: "nav.journal", icon: NotebookPen },
  { href: "/coach", labelKey: "nav.coach", icon: Sparkles },
] as const;

export const moreNavItem = { labelKey: "nav.more", icon: MoreHorizontal } as const;

// Contents of the mobile "More" sheet.
export const moreSheetItems = [
  { href: "/insights", labelKey: "nav.insights", icon: Radar, descriptionKey: "moreSheet.insightsDescription" },
  { href: "/knowledge", labelKey: "nav.knowledge", icon: BookOpen, descriptionKey: "moreSheet.knowledgeDescription" },
  { href: "/timeline", labelKey: "nav.timeline", icon: GanttChartSquare, descriptionKey: "moreSheet.timelineDescription" },
  { href: "/goals", labelKey: "nav.goals", icon: Target, descriptionKey: "moreSheet.goalsDescription" },
  { href: "/experiments", labelKey: "nav.experiments", icon: FlaskConical, descriptionKey: "moreSheet.experimentsDescription" },
  { href: "/profile", labelKey: "nav.profile", icon: CircleUserRound, descriptionKey: "moreSheet.profileDescription" },
] as const;
