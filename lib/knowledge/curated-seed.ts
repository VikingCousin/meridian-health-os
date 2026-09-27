// A small, deliberately bounded starter knowledge set — not an encyclopedia.
// Conservative language throughout ("may," "is associated with," "can be
// influenced by"). Never labeled GUIDELINE — that source type is reserved
// for an actually-imported clinical guideline document. See
// docs/KNOWLEDGE_ARCHITECTURE.md.

export interface CuratedDocSpec {
  fileName: string;
  markdown: string;
}

const SOURCE = "Meridian curated notes";

export const CURATED_KNOWLEDGE_DOCS: CuratedDocSpec[] = [
  {
    fileName: "brain-sleep-and-circadian-rhythm.md",
    markdown: `---
topic: sleep
bodySystem: brain
source: ${SOURCE}
---
# Sleep, Circadian Rhythm & HRV

## Sleep architecture
Sleep cycles through light, deep, and REM stages several times a night. Deep sleep is commonly associated with physical recovery, while REM is commonly associated with memory consolidation. A wearable's stage breakdown is an estimate, not a clinical polysomnogram.

## Circadian rhythm
The circadian rhythm is the body's roughly 24-hour internal clock, which is influenced by light exposure, meal timing, and sleep/wake consistency. Morning outdoor light exposure is commonly cited as a circadian anchor, and irregular sleep/wake timing may weaken it.

## Heart rate variability (HRV)
HRV can be influenced by sleep quality, training load, alcohol, illness, and stress — it is a general recovery signal rather than a diagnostic value, and is best interpreted as a personal trend over weeks rather than a single night's reading.

## Sleep and stress feedback loop
Poor sleep may raise next-day stress reactivity, and elevated stress can fragment the following night's sleep — the relationship is commonly described as bidirectional rather than one-directional.
`,
  },
  {
    fileName: "cardiovascular-lipids-and-fitness.md",
    markdown: `---
topic: cardiovascular
bodySystem: cardiovascular
source: ${SOURCE}
---
# Cardiovascular: Lipids, Blood Pressure & Fitness Markers

## ApoB and LDL-C
ApoB counts the number of atherogenic lipoprotein particles (including LDL, VLDL, and Lp(a)), while LDL-C measures the cholesterol carried within those particles. ApoB is increasingly discussed as a more direct measure of particle burden than LDL-C alone, though both are commonly used together with a clinician.

## Blood pressure
Blood pressure is influenced by sodium intake, stress, sleep, alcohol, and cardiovascular fitness. A single elevated reading is common and not by itself informative — trends across multiple readings, ideally at consistent times of day, are more meaningful.

## Resting heart rate
A lower resting heart rate is commonly associated with better cardiovascular fitness, but it also rises with poor sleep, illness, dehydration, and high stress — so a short-term increase is not necessarily a fitness change.

## VO2max
VO2max estimates the body's maximum oxygen-utilization capacity during exercise. It is well-established as a strong marker of aerobic fitness and is commonly improved through a mix of low-intensity (Zone 2) and higher-intensity interval training.
`,
  },
  {
    fileName: "liver-enzyme-panel.md",
    markdown: `---
topic: liver
bodySystem: liver
source: ${SOURCE}
---
# Liver Enzyme Panel: ALT, AST & GGT

## Why these enzymes are grouped together
ALT is found mainly in a liver cell's cytoplasm. AST is found in both the cytoplasm and mitochondria — and also in muscle tissue, not just the liver. GGT is associated with the cell membrane and the bile-duct (hepatobiliary) system. Because they originate from different cellular compartments and, in AST's case, different tissues entirely, the pattern across all three is generally considered more informative than any single value.

## What can affect these values
Alcohol intake, some medications and supplements, rapid weight change, and metabolic health more broadly can all influence liver enzyme levels — they are commonly read alongside metabolic and body-composition trends rather than in isolation.
`,
  },
  {
    fileName: "kidneys-creatinine-and-egfr.md",
    markdown: `---
topic: kidneys
bodySystem: kidneys
source: ${SOURCE}
---
# Kidneys: Creatinine & eGFR

## Creatinine and eGFR
Creatinine is a muscle-metabolism byproduct filtered by the kidneys; eGFR (estimated glomerular filtration rate) is calculated from creatinine, age, and sex as an estimate of kidney filtering capacity. Both are influenced by hydration and muscle mass, not only kidney function — a highly muscular person may show a naturally higher creatinine without reduced kidney function. These values are best read as a trend across multiple panels rather than a single reading.
`,
  },
  {
    fileName: "metabolic-glucose-fiber-protein.md",
    markdown: `---
topic: metabolic
bodySystem: metabolic
source: ${SOURCE}
---
# Metabolic Health: Glucose, Fiber & Protein

## Glucose and HbA1c
Fasting glucose reflects a single point in time, while HbA1c estimates average blood sugar over roughly the past 2-3 months. Both are influenced by diet, sleep, stress, illness, and activity level, and are commonly interpreted together rather than individually.

## Dietary fiber
Adequate dietary fiber intake is well-established in general nutrition guidance and is commonly associated with digestive health and more stable post-meal glucose responses.

## Protein distribution
Spreading protein intake fairly evenly across meals, rather than concentrating it in one meal, is commonly discussed in the context of muscle protein synthesis, though total daily intake is generally considered the larger factor.
`,
  },
  {
    fileName: "musculoskeletal-training-and-recovery.md",
    markdown: `---
topic: training
bodySystem: musculoskeletal
source: ${SOURCE}
---
# Training, Recovery, Sauna & Cold Exposure

## Zone 2 training
Regular low-intensity aerobic training (commonly called Zone 2) is a well-established way to build aerobic base fitness and is generally considered lower-risk for recovery than high-intensity work.

## Strength training
Regular resistance training is well-established for maintaining muscle mass and function, particularly as part of long-term healthy aging.

## Recovery and training load
Rising training load without matching recovery (sleep, nutrition, rest days) is when soreness and injury risk tend to build — self-reported soreness and pain are useful signals but are subjective, not a clinical measurement.

## Sauna
Regular sauna use is an area of emerging research interest for cardiovascular and recovery markers; evidence is still developing relative to more established interventions like training and sleep.

## Cold exposure
Cold exposure (cold showers, ice baths) is an area of emerging research interest, with mixed evidence on recovery and adaptation — some research suggests it may blunt certain muscle-building adaptations if used immediately after strength training.
`,
  },
  {
    fileName: "gut-health-overview.md",
    markdown: `---
topic: gut
bodySystem: gut
source: ${SOURCE}
---
# Gut Health Overview

## How gut markers interrelate
Stool-panel biomarkers (such as calprotectin and pancreatic elastase), microbiome diversity, and digestive symptoms are complex and interrelated — they are commonly read as trends over time alongside diet and symptom journaling, rather than as single values in isolation.
`,
  },
  {
    fileName: "immune-blood-differential.md",
    markdown: `---
topic: immune
bodySystem: immune
source: ${SOURCE}
---
# Immune: What a Blood Differential Shows

## What a blood differential shows
A complete blood count with differential breaks white blood cells into subtypes — neutrophils and monocytes respond quickly to bacterial threats and tissue damage, lymphocytes are central to antiviral and long-term adaptive immunity, and eosinophils/basophils are more associated with allergic and parasitic responses. Red cell markers (RBC, hemoglobin, hematocrit) and platelets describe oxygen-carrying capacity and clotting, not the immune response itself.

## Why a single reading is limited
These counts shift for many ordinary reasons — recent exercise, time of day, hydration, and minor illness — so a single differential outside its reference range is not, by itself, informative about any specific condition.
`,
  },
];
