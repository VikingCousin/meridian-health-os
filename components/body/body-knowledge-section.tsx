import Link from "next/link";
import { BookOpen, ShieldAlert } from "lucide-react";
import type { BodySystem } from "@/lib/generated/prisma/client";
import { searchKnowledge } from "@/lib/knowledge/search.service";

const SOURCE_LABEL: Record<string, string> = {
  CURATED: "Curated",
  USER_NOTES: "Your notes",
  NOTEBOOKLM_EXPORT: "Imported export",
  GUIDELINE: "Guideline",
  RESEARCH_SUMMARY: "Research summary",
  OTHER: "Other source",
};

/**
 * Replaces per-system hardcoded "what this system covers" paragraphs with
 * real HealthKnowledgeChunk records (Phase 7) — general knowledge, kept
 * visually separate from the personal data shown in the other tabs. Falls
 * back to a short prompt (never a fabricated claim) when nothing has been
 * curated or imported for this system yet.
 */
export async function BodyKnowledgeSection({ bodySystem, fallbackSummary }: { bodySystem: BodySystem; fallbackSummary: string }) {
  const results = await searchKnowledge({ bodySystem, limit: 6 });

  return (
    <div className="flex flex-col gap-4">
      {results.length > 0 ? (
        results.map((r) => (
          <div key={r.chunkId} className="rounded-xl border border-border-soft bg-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-medium text-foreground">{r.heading}</h3>
              <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {SOURCE_LABEL[r.sourceType] ?? r.sourceType}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">{r.content}</p>
            <p className="mt-2 text-[11px] text-muted-foreground/70">
              Source: {r.documentTitle}
              {r.sourceName ? ` — ${r.sourceName}` : ""}
            </p>
          </div>
        ))
      ) : (
        <div className="rounded-xl border border-border-soft bg-surface p-5">
          <h3 className="text-sm font-medium text-foreground">What this system covers</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{fallbackSummary}</p>
          <Link href="/knowledge" className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-accent hover:underline">
            <BookOpen className="h-3.5 w-3.5" /> Import or browse general knowledge
          </Link>
        </div>
      )}
      <div className="flex items-start gap-2.5 rounded-xl bg-surface-elevated p-4 text-[13px] text-muted-foreground">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-state-elevated" />
        <p>General health knowledge, not personal analysis or a diagnosis — see the other tabs for what your own data shows.</p>
      </div>
    </div>
  );
}
