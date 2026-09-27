// Phase 6 introduced this seam with a single static getNote() lookup and no
// real store behind it. Phase 7 implements the richer interface it always
// planned for — real search() over the local knowledge library
// (lib/knowledge/*, HealthKnowledgeDocument/Chunk) — while keeping getNote()
// as a small built-in fallback so a fresh install with an empty knowledge
// library still gets a one-line note for common interventions. Still no
// RAG, no vector database, no embeddings, no external AI call.
import { searchKnowledge } from "@/lib/knowledge/search.service";
import type { HealthKnowledgeProvider, KnowledgeQuery, KnowledgeResult } from "@/lib/knowledge/types";

const STATIC_NOTES: Record<string, string> = {
  "consistent-sleep-schedule": "Consistent sleep/wake timing commonly supports circadian regularity.",
  "morning-daylight": "Morning outdoor light exposure is commonly cited as a circadian anchor.",
  "reduce-late-meals": "Eating earlier in the evening is commonly associated with fewer overnight sleep disruptions.",
  "reduce-evening-alcohol": "Alcohol close to bedtime is commonly associated with lighter, more fragmented sleep.",
  "zone2-training": "Regular low-intensity aerobic training is a well-established way to build aerobic base fitness.",
  "vo2max-intervals": "Higher-intensity interval work is commonly used to raise aerobic ceiling once a base exists.",
  "strength-training": "Regular resistance training is well-established for maintaining muscle mass and function.",
  "mobility-work": "Regular mobility work is commonly used to support movement quality and reduce stiffness.",
  "sauna-sessions": "Regular sauna use is an area of emerging research interest for cardiovascular and recovery markers.",
  "cold-exposure": "Cold exposure is an area of emerging research interest, with mixed evidence on recovery and adaptation.",
  breathwork: "Structured breathing practices are commonly used as a low-cost stress-regulation tool.",
  "protein-distribution": "Spreading protein intake across meals is commonly discussed in the context of muscle protein synthesis.",
  "fiber-intake": "Dietary fiber intake is well-established in general nutrition guidance.",
  hydration: "Consistent hydration is well-established general guidance, especially around training.",
  "smoking-cessation-support": "Smoking cessation has among the strongest evidence bases of any behavior change for long-term health.",
};

class DbHealthKnowledgeProvider implements HealthKnowledgeProvider {
  async search(query: KnowledgeQuery): Promise<KnowledgeResult[]> {
    return searchKnowledge(query);
  }

  getNote(interventionId: string): string | undefined {
    return STATIC_NOTES[interventionId];
  }
}

export function getHealthKnowledgeProvider(): HealthKnowledgeProvider {
  return new DbHealthKnowledgeProvider();
}

export type { HealthKnowledgeProvider } from "@/lib/knowledge/types";
