/**
 * Development seed script — recreates the fictional "Alex" persona used
 * throughout the prototype. Wipes and rebuilds all tables, so it must never
 * be pointed at a production database (this app doesn't have one yet, but
 * the guard below exists so that stays true later).
 *
 * Run with: npm run db:seed
 */
import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { biomarkerCatalog } from "../lib/domain/biomarker-catalog";

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to run the dev seed script against a production environment.");
}

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./data/app.db" });
const prisma = new PrismaClient({ adapter });

// Phase 5: once real wearable/lab data has been imported, this script's
// unconditional wipe (resetDatabase(), below) becomes genuinely dangerous —
// see docs/WEARABLE_ARCHITECTURE.md, "Demo vs. real data isolation" and
// "Destructive reset safety." Refuse by default; ALLOW_DESTRUCTIVE_RESET=1
// (used by `npm run demo:reset`) is the explicit, deliberate override.
//
// V1 hardening: `npm run db:seed` is directly runnable and is NOT gated by
// scripts/check-safe-to-reset.ts (that guard only runs before `db:reset`),
// so this function needs the same two checks that script has — a real
// wearable import alone previously missed a real user who'd only uploaded
// labs, journaled, or set goals without ever connecting a device.
async function guardAgainstRealData() {
  if (process.env.ALLOW_DESTRUCTIVE_RESET === "1") return;
  try {
    const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
    if (settings && settings.demoMode === false) {
      console.error("\nRefusing to seed: this database is marked as real-user mode (AppSettings.demoMode = false).");
      console.error("This script deletes ALL data, including all real personal health data.");
      console.error("If you really want to wipe everything and reload the demo dataset, run:\n");
      console.error("  npm run demo:reset\n");
      process.exit(1);
    }

    const realDataSources = await prisma.healthDataSource.count({ where: { lastSuccessfulImportAt: { not: null } } });
    if (realDataSources > 0) {
      console.error(`\nRefusing to seed: ${realDataSources} data source(s) have a real, successful import.`);
      console.error("This script deletes ALL data, including any real wearable/lab data you've imported.");
      console.error("If you really want to wipe everything and reload the demo dataset, run:\n");
      console.error("  npm run demo:reset\n");
      process.exit(1);
    }
  } catch {
    return; // tables don't exist yet on a brand-new database — nothing to protect
  }
}

// --- deterministic pseudo-random series generation -------------------------
// Not cryptographic — just gives us reproducible, plausible-looking daily
// wearable-style data without hand-writing hundreds of literal numbers.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dailySeries(opts: {
  start: Date;
  end: Date;
  base: number;
  trendPerDay: number;
  noiseAmp: number;
  seed: number;
  decimals?: number;
  min?: number;
  max?: number;
  /**
   * Deliberate per-date deltas layered on top of the smooth generated trend
   * (keyed by "YYYY-MM-DD"), applied before clamping. Used to hand-place
   * realistic, imperfect Phase 4 demo patterns (e.g. shorter sleep the night
   * after a late meal) without hand-authoring an entire series.
   */
  overrides?: Record<string, number>;
}): { date: Date; value: number }[] {
  const rng = mulberry32(opts.seed);
  const dayCount = Math.round((opts.end.getTime() - opts.start.getTime()) / (1000 * 60 * 60 * 24));
  const decimals = opts.decimals ?? 1;
  const points: { date: Date; value: number }[] = [];

  for (let i = 0; i <= dayCount; i++) {
    const date = addDays(opts.start, i);
    const override = opts.overrides?.[toDateKey(date)] ?? 0;
    const raw = opts.base + opts.trendPerDay * i + (rng() - 0.5) * 2 * opts.noiseAmp + override;
    const clamped = Math.min(opts.max ?? Infinity, Math.max(opts.min ?? -Infinity, raw));
    const value = Math.round(clamped * 10 ** decimals) / 10 ** decimals;
    points.push({ date, value });
  }
  return points;
}

function addOverride(map: Record<string, number>, dateKey: string, delta: number) {
  map[dateKey] = (map[dateKey] ?? 0) + delta;
}

// --- Phase 4 demo pattern dates ---------------------------------------
// Deliberately imperfect: each exposure list includes occasions that do
// NOT show the "expected" effect, so the pattern engine has real
// contradicting evidence to surface (never seed a suspiciously clean
// correlation — see docs/ANALYTICS_ARCHITECTURE.md).
const LATE_MEAL_DATES = [
  "2026-04-10",
  "2026-04-22",
  "2026-05-03",
  "2026-05-15",
  "2026-05-29",
  "2026-06-12",
  "2026-06-25",
  "2026-07-08",
  "2026-07-20",
  "2026-08-05",
];
// Nights 04-10, 04-22, 05-03, 05-29, 06-12, 07-08, 07-20 -> below-baseline sleep (7 of 10).
// Nights 05-15, 06-25, 08-05 -> normal sleep despite the late meal (3 of 10, contradicting).
const ALCOHOL_DATES = ["2026-04-22", "2026-05-20", "2026-06-12", "2026-06-30", "2026-07-20", "2026-08-15"];
// 04-22, 05-20, 06-12, 06-30 -> lower next-day HRV (4 of 6).
// 07-20, 08-15 -> no meaningful HRV change (2 of 6, contradicting).
const SAUNA_DATES = ["2026-04-15", "2026-05-08", "2026-06-02", "2026-07-14", "2026-08-20"];
// Mixed outcomes on purpose: 3 mild improvements, 2 with no clear change.

function buildPatternOverrides() {
  const sleepDuration: Record<string, number> = {};
  const sleepScore: Record<string, number> = {};
  const hrv: Record<string, number> = {};

  const lateMealEffect: Record<string, { sleepHours: number; sleepScore: number }> = {
    "2026-04-10": { sleepHours: -0.83, sleepScore: -12 },
    "2026-04-22": { sleepHours: -0.92, sleepScore: -13 },
    "2026-05-03": { sleepHours: -0.75, sleepScore: -10 },
    "2026-05-15": { sleepHours: 0.08, sleepScore: 1 },
    "2026-05-29": { sleepHours: -0.8, sleepScore: -11 },
    "2026-06-12": { sleepHours: -1.0, sleepScore: -14 },
    "2026-06-25": { sleepHours: 0.13, sleepScore: 2 },
    "2026-07-08": { sleepHours: -0.87, sleepScore: -12 },
    "2026-07-20": { sleepHours: -0.67, sleepScore: -9 },
    "2026-08-05": { sleepHours: 0.05, sleepScore: 0 },
  };
  for (const date of LATE_MEAL_DATES) {
    const outcomeKey = toDateKey(addDays(new Date(date), 1));
    const effect = lateMealEffect[date];
    addOverride(sleepDuration, outcomeKey, effect.sleepHours);
    addOverride(sleepScore, outcomeKey, effect.sleepScore);
  }

  const alcoholEffect: Record<string, number> = {
    "2026-04-22": -7,
    "2026-05-20": -8,
    "2026-06-12": -6,
    "2026-06-30": -9,
    "2026-07-20": 0.5,
    "2026-08-15": 1,
  };
  for (const date of ALCOHOL_DATES) {
    const outcomeKey = toDateKey(addDays(new Date(date), 1));
    addOverride(hrv, outcomeKey, alcoholEffect[date]);
  }

  const saunaEffect: Record<string, { hrv: number; sleepHours: number }> = {
    "2026-04-15": { hrv: 3, sleepHours: 0.25 },
    "2026-05-08": { hrv: 4, sleepHours: 0.3 },
    "2026-06-02": { hrv: 0.5, sleepHours: 0.05 },
    "2026-07-14": { hrv: 3.5, sleepHours: 0.2 },
    "2026-08-20": { hrv: -0.5, sleepHours: -0.05 },
  };
  for (const date of SAUNA_DATES) {
    const outcomeKey = toDateKey(addDays(new Date(date), 1));
    const effect = saunaEffect[date];
    addOverride(hrv, outcomeKey, effect.hrv);
    addOverride(sleepDuration, outcomeKey, effect.sleepHours);
  }

  return { sleepDuration, sleepScore, hrv };
}

async function resetDatabase() {
  await prisma.coachPriority.deleteMany();
  await prisma.healthMode.deleteMany();
  await prisma.insightEvidence.deleteMany();
  await prisma.healthInsight.deleteMany();
  await prisma.normalizedHealthEvent.deleteMany();
  await prisma.sleepSession.deleteMany();
  await prisma.workoutSession.deleteMany();
  await prisma.wearableImportSession.deleteMany();
  await prisma.healthDataSource.deleteMany();
  await prisma.labExtractionItem.deleteMany();
  await prisma.labExtractionSession.deleteMany();
  await prisma.biomarkerMeasurement.deleteMany();
  await prisma.healthDocument.deleteMany();
  await prisma.biomarkerDefinition.deleteMany();
  await prisma.journalObservation.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.experimentOutcome.deleteMany();
  await prisma.healthExperiment.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.medicalHistory.deleteMany();
  await prisma.medication.deleteMany();
  await prisma.supplement.deleteMany();
  await prisma.userProfile.deleteMany();
}

async function seedProfile() {
  return prisma.userProfile.create({
    data: {
      firstName: "Alex",
      dateOfBirth: new Date("1988-04-12"),
      biologicalSex: "PREFER_NOT_TO_SAY",
      heightCm: 178,
      currentWeightKg: 78.4,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
      occupation: "Software Engineer",
      activityLevel: "VERY_ACTIVE",
      generalHealthNotes: "Focused on longevity: consistent strength training, Zone 2 cardio, and Judo.",
      medicalHistory: {
        create: [
          {
            condition: "Seasonal allergies",
            status: "MANAGED",
            source: "SELF_REPORTED",
            notes: "Mild, spring months. Managed with antihistamines as needed.",
          },
        ],
      },
      supplements: {
        create: [
          {
            name: "Magnesium Glycinate",
            productName: "Magnesium Glycinate 400",
            dose: 400,
            unit: "mg",
            frequency: "Nightly",
            startedAt: new Date("2026-07-20"),
            active: true,
            notes: "Started to support sleep quality.",
          },
          {
            name: "Vitamin D3",
            dose: 2000,
            unit: "IU",
            frequency: "Daily",
            startedAt: new Date("2026-01-05"),
            active: true,
          },
        ],
      },
    },
  });
}

async function seedBiomarkers() {
  const definitions = new Map<string, string>(); // canonicalKey -> id

  for (const entry of biomarkerCatalog) {
    const created = await prisma.biomarkerDefinition.create({
      data: {
        canonicalKey: entry.canonicalKey,
        displayName: entry.displayName,
        shortName: entry.shortName,
        category: entry.category,
        defaultUnit: entry.defaultUnit,
        description: entry.description,
        whyItMatters: entry.whyItMatters,
        bodySystem: entry.bodySystem,
        aliases: entry.aliases,
      },
    });
    definitions.set(entry.canonicalKey, created.id);
  }

  const labPanelSource = { sourceType: "LAB_REPORT" as const };

  async function addMeasurement(
    key: string,
    value: number,
    measuredAt: Date,
    opts: {
      unit?: string;
      referenceMin?: number;
      referenceMax?: number;
      personalTargetMin?: number;
      personalTargetMax?: number;
      sourceType?: "LAB_REPORT" | "WEARABLE" | "MANUAL" | "IMPORT" | "AI_EXTRACTED" | "CALCULATED";
    } = {}
  ) {
    const definitionId = definitions.get(key);
    if (!definitionId) throw new Error(`Unknown biomarker key in seed: ${key}`);
    const catalogEntry = biomarkerCatalog.find((c) => c.canonicalKey === key)!;
    await prisma.biomarkerMeasurement.create({
      data: {
        biomarkerDefinitionId: definitionId,
        value,
        unit: opts.unit ?? catalogEntry.defaultUnit ?? "",
        measuredAt,
        referenceMin: opts.referenceMin,
        referenceMax: opts.referenceMax,
        personalTargetMin: opts.personalTargetMin,
        personalTargetMax: opts.personalTargetMax,
        sourceType: opts.sourceType ?? labPanelSource.sourceType,
        verified: true,
      },
    });
  }

  // --- Lipid panel history (4 lab dates) ---
  const labDates = [new Date("2025-02-10"), new Date("2025-06-14"), new Date("2026-01-18"), new Date("2026-08-21")];
  const apob = [104, 91, 78, 74];
  const ldl = [128, 118, 112, 101];
  const hdl = [52, 55, 58, 61];
  const tri = [105, 94, 89, 72];
  for (let i = 0; i < labDates.length; i++) {
    await addMeasurement("apob", apob[i], labDates[i], { referenceMax: 100, personalTargetMax: 80 });
    await addMeasurement("ldl_c", ldl[i], labDates[i], { referenceMax: 130, personalTargetMax: 100 });
    await addMeasurement("hdl_c", hdl[i], labDates[i], { referenceMin: 40 });
    await addMeasurement("triglycerides", tri[i], labDates[i], { referenceMax: 150, personalTargetMax: 80 });
  }

  // --- Glycemic + blood pressure (3 lab dates, subset of labDates) ---
  const glycemicDates = [labDates[1], labDates[2], labDates[3]];
  const hba1c = [5.4, 5.3, 5.2];
  const glucose = [93, 91, 88];
  const systolic = [124, 122, 118];
  const diastolic = [78, 75, 72];
  for (let i = 0; i < glycemicDates.length; i++) {
    await addMeasurement("hba1c", hba1c[i], glycemicDates[i], { referenceMax: 5.7, personalTargetMax: 5.3 });
    await addMeasurement("fasting_glucose", glucose[i], glycemicDates[i], { referenceMax: 99 });
    await addMeasurement("blood_pressure_systolic", systolic[i], glycemicDates[i]);
    await addMeasurement("blood_pressure_diastolic", diastolic[i], glycemicDates[i]);
  }

  // --- Body composition (monthly, 2026) ---
  const bodyFatDates = [new Date("2026-03-01"), new Date("2026-05-01"), new Date("2026-07-01"), new Date("2026-09-01")];
  const bodyFat = [18.4, 17.5, 16.9, 16.2];
  for (let i = 0; i < bodyFatDates.length; i++) {
    await addMeasurement("body_fat_percentage", bodyFat[i], bodyFatDates[i], { personalTargetMax: 15 });
  }

  // --- VO2max (bi-monthly, 2026) ---
  const vo2Dates = [new Date("2026-03-01"), new Date("2026-05-01"), new Date("2026-07-01"), new Date("2026-09-01")];
  const vo2 = [43, 44, 45, 47];
  for (let i = 0; i < vo2Dates.length; i++) {
    await addMeasurement("vo2max", vo2[i], vo2Dates[i], { personalTargetMin: 50, sourceType: "WEARABLE" });
  }

  // --- Gut panel (Viome, 2 dates) ---
  await addMeasurement("microbiome_diversity", 5.4, new Date("2025-10-02"), { referenceMin: 6, referenceMax: 9 });
  await addMeasurement("microbiome_diversity", 6.8, new Date("2026-05-04"), { referenceMin: 6, referenceMax: 9 });
  await addMeasurement("calprotectin", 45, new Date("2025-10-02"), { referenceMax: 50 });
  await addMeasurement("calprotectin", 32, new Date("2026-05-04"), { referenceMax: 50 });
  await addMeasurement("pancreatic_elastase", 312, new Date("2026-05-04"), { referenceMin: 200 });

  // --- Liver panel (2 lab dates, subset of labDates) ---
  const liverDates = [labDates[2], labDates[3]];
  const alt = [24, 22];
  const ast = [21, 19];
  const ggt = [28, 24];
  for (let i = 0; i < liverDates.length; i++) {
    await addMeasurement("alt", alt[i], liverDates[i], { referenceMax: 44 });
    await addMeasurement("ast", ast[i], liverDates[i], { referenceMax: 40 });
    await addMeasurement("ggt", ggt[i], liverDates[i], { referenceMax: 65 });
  }
  // bilirubin_total is intentionally left unseeded — the Liver page's
  // "No data" state is real, not simulated, for a marker this panel didn't include.

  // --- Kidney panel (2 lab dates, subset of labDates) ---
  const kidneyDates = [labDates[2], labDates[3]];
  const creatinine = [0.95, 0.9];
  for (let i = 0; i < kidneyDates.length; i++) {
    await addMeasurement("creatinine", creatinine[i], kidneyDates[i], { referenceMin: 0.7, referenceMax: 1.3 });
    await addMeasurement("egfr", 96, kidneyDates[i], { referenceMin: 90 });
  }

  // --- Blood / immune differential (1 lab date) — a partial CBC on purpose:
  // monocytes, eosinophils, and basophils are left unseeded so the radial
  // panel's "No data" state reflects a real gap, not a simulated one.
  const cbcDate = labDates[3];
  await addMeasurement("erythrocytes", 5.1, cbcDate, { referenceMin: 4.5, referenceMax: 5.9 });
  await addMeasurement("hemoglobin", 15.2, cbcDate, { referenceMin: 13.5, referenceMax: 17.5 });
  await addMeasurement("hematocrit", 45, cbcDate, { referenceMin: 41, referenceMax: 53 });
  await addMeasurement("leukocytes", 5.8, cbcDate, { referenceMin: 4, referenceMax: 11 });
  await addMeasurement("neutrophils", 54, cbcDate, { referenceMin: 40, referenceMax: 70 });
  await addMeasurement("lymphocytes", 34, cbcDate, { referenceMin: 20, referenceMax: 45 });
  await addMeasurement("platelets", 238, cbcDate, { referenceMin: 150, referenceMax: 400 });

  // --- Daily wearable-style series (drives Experiment before/after snapshots
  // and, for hrv/sleep_score/sleep_duration, the Phase 4 pattern engine) ---
  const seriesStart = new Date("2026-04-01");
  const seriesEnd = new Date("2026-09-06");
  const patternOverrides = buildPatternOverrides();

  const wearableSeries: {
    key: string;
    base: number;
    trendPerDay: number;
    noiseAmp: number;
    seed: number;
    decimals?: number;
    min?: number;
    max?: number;
    overrides?: Record<string, number>;
  }[] = [
    { key: "hrv", base: 45, trendPerDay: 0.045, noiseAmp: 4, seed: 1, min: 30, max: 70, overrides: patternOverrides.hrv },
    { key: "sleep_score", base: 76, trendPerDay: 0.035, noiseAmp: 6, seed: 2, decimals: 0, min: 55, max: 96, overrides: patternOverrides.sleepScore },
    { key: "resting_hr", base: 59, trendPerDay: -0.028, noiseAmp: 2, seed: 3, decimals: 0, min: 48, max: 64 },
    { key: "training_load", base: 240, trendPerDay: 0.25, noiseAmp: 30, seed: 4, decimals: 0, min: 150, max: 380 },
    // Promoted from the 14-day recentSeries below: LATE_MEAL/ALCOHOL/SAUNA
    // associations need a full-range outcome series, not just the last two weeks.
    { key: "sleep_duration", base: 6.9, trendPerDay: 0, noiseAmp: 0.6, seed: 5, min: 4, max: 8.5, overrides: patternOverrides.sleepDuration },
  ];

  for (const s of wearableSeries) {
    const points = dailySeries({
      start: seriesStart,
      end: seriesEnd,
      base: s.base,
      trendPerDay: s.trendPerDay,
      noiseAmp: s.noiseAmp,
      seed: s.seed,
      decimals: s.decimals,
      min: s.min,
      max: s.max,
      overrides: s.overrides,
    });
    for (const p of points) {
      await addMeasurement(s.key, p.value, p.date, { sourceType: "WEARABLE" });
    }
  }

  // Shorter 14-day series for the remaining dashboard-only wearable metrics.
  const recentStart = new Date("2026-08-24");
  const recentSeries = [
    { key: "deep_sleep", base: 82, trendPerDay: 0, noiseAmp: 18, seed: 6, decimals: 0, min: 45, max: 115 },
    { key: "rem_sleep", base: 96, trendPerDay: 0, noiseAmp: 14, seed: 7, decimals: 0, min: 70, max: 120 },
    { key: "stress_level", base: 35, trendPerDay: 0, noiseAmp: 9, seed: 8, decimals: 0, min: 15, max: 55 },
    { key: "spo2", base: 97, trendPerDay: 0, noiseAmp: 1, seed: 9, decimals: 0, min: 94, max: 99 },
  ];
  for (const s of recentSeries) {
    const points = dailySeries({
      start: recentStart,
      end: seriesEnd,
      base: s.base,
      trendPerDay: s.trendPerDay,
      noiseAmp: s.noiseAmp,
      seed: s.seed,
      decimals: s.decimals,
      min: s.min,
      max: s.max,
    });
    for (const p of points) {
      await addMeasurement(s.key, p.value, p.date, { sourceType: "WEARABLE" });
    }
  }
}

type JournalSeedEntry = { date: string; text: string; observations: { type: string; label: string; normalizedValue: string }[] };

// Explicit journal entries for the Phase 4 demo exposure dates above — hand
// authored (not run through the mock keyword tagger) so the normalized-event
// counts exactly match the intended, deliberately imperfect pattern. Three
// dates carry both a late meal and alcohol, which is also what gives the
// association engine's confounding/overlap detection something real to find.
const PATTERN_JOURNAL_ENTRIES: JournalSeedEntry[] = [
  { date: "2026-04-10", text: "Ate a late, heavy dinner again — didn't finish until almost 10pm. Otherwise a normal day.", observations: [{ type: "FOOD", label: "Late large meal", normalizedValue: "Late meal" }] },
  { date: "2026-04-15", text: "Sauna session after training tonight, 20 minutes. Felt great and relaxed afterward.", observations: [{ type: "LIFESTYLE", label: "Sauna session", normalizedValue: "Sauna" }] },
  { date: "2026-04-22", text: "Had a late dinner with wine after a work event — probably ate too late and had a couple of drinks.", observations: [
    { type: "FOOD", label: "Late large meal", normalizedValue: "Late meal" },
    { type: "ALCOHOL", label: "Alcohol consumed", normalizedValue: "Alcohol" },
  ] },
  { date: "2026-05-03", text: "Late pasta dinner tonight after getting home from a late meeting.", observations: [{ type: "FOOD", label: "Late large meal", normalizedValue: "Late meal" }] },
  { date: "2026-05-08", text: "Sauna after Judo practice, 15 minutes. Good way to wind down.", observations: [{ type: "LIFESTYLE", label: "Sauna session", normalizedValue: "Sauna" }] },
  { date: "2026-05-15", text: "Ordered takeout late again, ate around 9:30pm.", observations: [{ type: "FOOD", label: "Late large meal", normalizedValue: "Late meal" }] },
  { date: "2026-05-20", text: "Drinks with friends tonight, a few beers and a whiskey.", observations: [{ type: "ALCOHOL", label: "Alcohol consumed", normalizedValue: "Alcohol" }] },
  { date: "2026-05-29", text: "Late dinner after a long day at the office, didn't eat until 9pm.", observations: [{ type: "FOOD", label: "Late large meal", normalizedValue: "Late meal" }] },
  { date: "2026-06-02", text: "Quick sauna session before bed, felt very relaxed.", observations: [{ type: "LIFESTYLE", label: "Sauna session", normalizedValue: "Sauna" }] },
  { date: "2026-06-12", text: "Dinner party ran late — big meal and a couple glasses of wine well into the evening.", observations: [
    { type: "FOOD", label: "Late large meal", normalizedValue: "Late meal" },
    { type: "ALCOHOL", label: "Alcohol consumed", normalizedValue: "Alcohol" },
  ] },
  { date: "2026-06-25", text: "Ate a big late meal after an evening workout, later than usual.", observations: [{ type: "FOOD", label: "Late large meal", normalizedValue: "Late meal" }] },
  { date: "2026-06-30", text: "A few drinks at a friend's birthday tonight.", observations: [{ type: "ALCOHOL", label: "Alcohol consumed", normalizedValue: "Alcohol" }] },
  { date: "2026-07-08", text: "Late dinner again tonight, finished eating close to bedtime.", observations: [{ type: "FOOD", label: "Late large meal", normalizedValue: "Late meal" }] },
  { date: "2026-07-14", text: "20-minute sauna session after training, felt good.", observations: [{ type: "LIFESTYLE", label: "Sauna session", normalizedValue: "Sauna" }] },
  { date: "2026-07-20", text: "Big late dinner and wine at a family gathering tonight.", observations: [
    { type: "FOOD", label: "Late large meal", normalizedValue: "Late meal" },
    { type: "ALCOHOL", label: "Alcohol consumed", normalizedValue: "Alcohol" },
  ] },
  { date: "2026-08-05", text: "Late dinner after a long travel day.", observations: [{ type: "FOOD", label: "Late large meal", normalizedValue: "Late meal" }] },
  { date: "2026-08-15", text: "A couple of drinks out with coworkers tonight.", observations: [{ type: "ALCOHOL", label: "Alcohol consumed", normalizedValue: "Alcohol" }] },
  { date: "2026-08-20", text: "Sauna session tonight, nothing unusual otherwise.", observations: [{ type: "LIFESTYLE", label: "Sauna session", normalizedValue: "Sauna" }] },
];

async function seedJournal() {
  const entries: JournalSeedEntry[] = [
    {
      date: "2026-09-06",
      text: "Felt tired today. I ate a large pasta dinner late yesterday and woke up several times. Training was okay but motivation was low.",
      observations: [
        { type: "FOOD", label: "Late large meal", normalizedValue: "Late meal" },
        { type: "SLEEP", label: "Multiple sleep interruptions", normalizedValue: "Poor sleep" },
        { type: "MOOD", label: "Morning fatigue", normalizedValue: "Low motivation" },
        { type: "TRAINING", label: "Training session logged", normalizedValue: "Training" },
      ],
    },
    {
      date: "2026-09-03",
      text: "Really good Judo session tonight, sparring felt sharp. Shoulder is a bit sore from last week but nothing concerning. Slept great after.",
      observations: [
        { type: "TRAINING", label: "High training intensity", normalizedValue: "Judo" },
        { type: "PAIN", label: "Minor joint soreness", normalizedValue: "Soreness" },
        { type: "SLEEP", label: "Good sleep quality", normalizedValue: "Good sleep" },
      ],
    },
    {
      date: "2026-08-29",
      text: "Bloating after dinner again, third time this month. Wonder if it's the dairy or just eating too fast. Energy was fine otherwise.",
      observations: [
        { type: "SYMPTOM", label: "Recurring digestive symptom", normalizedValue: "Digestion" },
        { type: "FOOD", label: "Possible dietary trigger", normalizedValue: "Nutrition" },
      ],
    },
    {
      date: "2026-08-24",
      text: "Stressful week at work, noticed my heart rate felt elevated even at rest. Trying to prioritize a wind-down routine before bed.",
      observations: [
        { type: "STRESS", label: "Work stress", normalizedValue: "Stress" },
        { type: "SLEEP", label: "Sleep hygiene intent", normalizedValue: "Sleep" },
      ],
    },
    {
      date: "2026-08-18",
      text: "Very tired today after a poor night of sleep. Skipped the planned Zone 2 run, just didn't have it in me.",
      observations: [
        { type: "SLEEP", label: "Poor sleep", normalizedValue: "Poor sleep" },
        { type: "MOOD", label: "Fatigue", normalizedValue: "Fatigue" },
        { type: "TRAINING", label: "Skipped training session", normalizedValue: "Training" },
      ],
    },
  ];

  for (const entry of [...entries, ...PATTERN_JOURNAL_ENTRIES]) {
    await prisma.journalEntry.create({
      data: {
        text: entry.text,
        entryDate: new Date(entry.date),
        observations: {
          create: entry.observations.map((o) => ({
            type: o.type as never,
            label: o.label,
            normalizedValue: o.normalizedValue,
            confidence: 0.6,
            source: "AI_EXTRACTED",
          })),
        },
      },
    });
  }
}

async function seedGoals() {
  const longevity = await prisma.goal.create({
    data: {
      title: "Longevity / Healthspan",
      description: "Maximize healthy, capable years — the goal underneath every other goal.",
      category: "LONGEVITY",
      kind: "LONG_TERM",
      priority: "HIGH",
      status: "ON_TRACK",
      progress: 68,
      timeHorizon: "LONG_TERM",
      rationale: "Every supporting goal and project below exists in service of this one.",
    },
  });

  const supporting: { title: string; description: string; category: string; progress: number; status: string; bodySystems: string[] }[] = [
    { title: "Cardiovascular Health", description: "Keep ApoB and blood pressure well within personal targets.", category: "CARDIOVASCULAR", progress: 82, status: "ON_TRACK", bodySystems: ["CARDIOVASCULAR"] },
    { title: "Strength", description: "Maintain lean mass and functional strength into your 50s and beyond.", category: "STRENGTH", progress: 64, status: "ON_TRACK", bodySystems: ["MUSCULOSKELETAL"] },
    { title: "Aerobic Fitness", description: "Push VO2max past 50 mL/kg/min.", category: "AEROBIC", progress: 71, status: "ON_TRACK", bodySystems: ["CARDIOVASCULAR"] },
    { title: "Sleep", description: "Build a consistent sleep window and reduce night-to-night variability.", category: "SLEEP", progress: 46, status: "ATTENTION", bodySystems: ["BRAIN"] },
    { title: "Metabolic Health", description: "Keep HbA1c and body composition trending favorably.", category: "METABOLIC", progress: 75, status: "ON_TRACK", bodySystems: ["METABOLIC"] },
    { title: "Immune Resilience", description: "Minimize illness frequency and duration through recovery discipline.", category: "IMMUNE", progress: 80, status: "ON_TRACK", bodySystems: ["IMMUNE"] },
  ];

  for (const g of supporting) {
    await prisma.goal.create({
      data: {
        title: g.title,
        description: g.description,
        category: g.category as never,
        kind: "SUPPORTING",
        priority: "MEDIUM",
        status: g.status as never,
        progress: g.progress,
        parentGoalId: longevity.id,
        bodySystems: g.bodySystems,
      },
    });
  }

  await prisma.goal.create({
    data: {
      title: "Judo Competition",
      description: "Build strength and aerobic base ahead of competition.",
      category: "PERFORMANCE",
      kind: "PROJECT",
      priority: "MEDIUM",
      status: "ON_TRACK",
      targetDate: new Date("2027-05-15"),
      startDate: new Date("2026-04-15"),
      bodySystems: ["MUSCULOSKELETAL", "CARDIOVASCULAR"],
      timeHorizon: "TEMPORARY",
      rationale: "A concrete near-term project that temporarily shifts priority toward recovery and performance.",
      successCriteria: "Compete at target weight class with no unresolved soreness/injury flags in the two weeks prior.",
    },
  });

  await prisma.goal.create({
    data: {
      title: "Quit Smoking",
      description: "Currently in preparation phase — no active quit date set yet.",
      category: "HABIT",
      kind: "PROJECT",
      priority: "LOW",
      status: "PREPARATION",
      timeHorizon: "TEMPORARY",
    },
  });
}

async function seedHealthModes() {
  // Demonstrates a temporary prioritization modifier: while this is active,
  // the prioritization engine boosts RECOVERY-category candidates and
  // suppresses STRENGTH-category ones (recovery/performance temporarily
  // outrank hypertrophy work during competition prep) — see
  // docs/COACH_ARCHITECTURE.md, "Health modes."
  await prisma.healthMode.create({
    data: {
      title: "Judo competition prep",
      type: "COMPETITION_PREP",
      status: "ACTIVE",
      startedAt: new Date("2026-08-01"),
      targetEndAt: new Date("2027-05-15"),
      priorityModifier: { boostCategories: ["RECOVERY"], suppressCategories: ["STRENGTH"] },
      notes: "Recovery and performance temporarily outrank additional hypertrophy work ahead of competition.",
    },
  });
}

async function seedExperiments() {
  await prisma.healthExperiment.create({
    data: {
      title: "No large meals within 3 hours of bedtime",
      hypothesis: "Eating earlier in the evening will improve sleep quality and next-day HRV.",
      protocol: "No food intake within 3 hours of the planned bedtime, every night for 14 days.",
      startDate: new Date("2026-08-29"),
      endDate: new Date("2026-09-12"),
      status: "ACTIVE",
      outcomes: {
        create: [
          { metricType: "BIOMARKER", metricReference: "sleep_score", label: "Sleep score" },
          { metricType: "BIOMARKER", metricReference: "hrv", label: "HRV" },
          { metricType: "BIOMARKER", metricReference: "resting_hr", label: "Resting HR" },
          { metricType: "SUBJECTIVE_RATING", label: "Morning energy" },
        ],
      },
    },
  });

  await prisma.healthExperiment.create({
    data: {
      title: "Sauna 3x per week",
      hypothesis: "Regular heat exposure will improve HRV and subjective recovery.",
      protocol: "One 20-minute sauna session, 3 times per week, for 3 weeks.",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-06-22"),
      status: "COMPLETED",
      outcomes: {
        create: [
          { metricType: "BIOMARKER", metricReference: "hrv", label: "HRV" },
          { metricType: "BIOMARKER", metricReference: "sleep_score", label: "Sleep score" },
          { metricType: "SUBJECTIVE_RATING", label: "Subjective recovery" },
        ],
      },
    },
  });

  await prisma.healthExperiment.create({
    data: {
      title: "10 minutes of morning sunlight",
      hypothesis: "Early light exposure will stabilize circadian rhythm and improve sleep consistency.",
      protocol: "10 minutes of outdoor light exposure within 30 minutes of waking, daily for 14 days.",
      startDate: new Date("2026-09-10"),
      endDate: new Date("2026-09-24"),
      status: "PLANNED",
      outcomes: {
        create: [
          { metricType: "JOURNAL_OBSERVATION", metricReference: "SLEEP", label: "Sleep consistency" },
          { metricType: "SUBJECTIVE_RATING", label: "Subjective energy" },
        ],
      },
    },
  });
}

/**
 * One pre-accepted priority, so the Coach demo isn't a blank slate — mirrors
 * exactly what "Add to this week" does at runtime, just run once here
 * against the real seeded goal + insight ids (see docs/COACH_ARCHITECTURE.md,
 * "User acceptance": priorities are never created except via this explicit path).
 */
async function seedCoachPriority() {
  const sleepGoal = await prisma.goal.findFirst({ where: { title: "Sleep" } });
  const lateMealInsight = await prisma.healthInsight.findUnique({ where: { fingerprint: "association:LATE_MEAL:sleep_duration:NEXT_NIGHT" } });
  if (!sleepGoal) return;

  await prisma.coachPriority.create({
    data: {
      interventionDefinitionId: "reduce-late-meals",
      title: "Avoid large meals within 3 hours of bed",
      status: "ACCEPTED",
      score: 78,
      rank: 0,
      reason: lateMealInsight
        ? "Linked to a recorded personal pattern: LATE MEALS ↔ SLEEP DURATION"
        : "Supports your active goal: Sleep",
      linkedGoalIds: [sleepGoal.id],
      linkedInsightIds: lateMealInsight ? [lateMealInsight.id] : [],
      metadata: { confidence: "moderate", burden: "MEDIUM", requiresMedicalReview: false },
    },
  });
}

async function seedCuratedKnowledge() {
  const { importMarkdown } = await import("../lib/knowledge/knowledge.service");
  const { CURATED_KNOWLEDGE_DOCS } = await import("../lib/knowledge/curated-seed");
  for (const doc of CURATED_KNOWLEDGE_DOCS) {
    await importMarkdown({ raw: doc.markdown, fallbackTitle: doc.fileName, sourceType: "CURATED" });
  }
}

async function main() {
  await guardAgainstRealData();

  console.log("Resetting database...");
  await resetDatabase();

  console.log("Seeding profile...");
  await seedProfile();

  console.log("Seeding biomarker catalog + measurements...");
  await seedBiomarkers();

  console.log("Seeding journal entries...");
  await seedJournal();

  console.log("Seeding goals...");
  await seedGoals();

  console.log("Seeding experiments...");
  await seedExperiments();

  console.log("Seeding health modes...");
  await seedHealthModes();

  console.log("Running initial pattern analysis...");
  const { analyzeHealthData } = await import("../lib/analytics/health-analysis.service");
  const summary = await analyzeHealthData();
  console.log(`  -> ${summary.insightsCreated} insight(s) created, ${summary.candidatesEvaluated} candidate(s) evaluated.`);

  console.log("Seeding one accepted Coach priority...");
  await seedCoachPriority();

  console.log("Seeding curated health knowledge...");
  await seedCuratedKnowledge();

  console.log("Marking this database as demo mode...");
  const { setDemoMode } = await import("../lib/services/settings.service");
  await setDemoMode(true);

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
