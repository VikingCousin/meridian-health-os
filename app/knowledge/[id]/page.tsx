import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { getKnowledgeDocument } from "@/lib/knowledge/knowledge.service";

const SOURCE_LABEL: Record<string, string> = {
  CURATED: "Curated",
  USER_NOTES: "Your notes",
  NOTEBOOKLM_EXPORT: "Imported export",
  GUIDELINE: "Guideline",
  RESEARCH_SUMMARY: "Research summary",
  OTHER: "Other source",
};

export default async function KnowledgeDocumentPage(props: PageProps<"/knowledge/[id]">) {
  const { id } = await props.params;
  const doc = await getKnowledgeDocument(id);
  if (!doc) notFound();

  return (
    <PageContainer className="animate-fade-in-up max-w-3xl">
      <Link href="/knowledge" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Knowledge library
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-[24px] font-bold tracking-tight sm:text-[28px]">{doc.title}</h1>
        <Badge variant="outline">{SOURCE_LABEL[doc.sourceType] ?? doc.sourceType}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {doc.sourceName ? `${doc.sourceName} · ` : ""}
        {doc.topic ? `Topic: ${doc.topic}` : ""}
        {doc.bodySystem ? ` · Body system: ${doc.bodySystem.toLowerCase()}` : ""}
      </p>
      {doc.sourceType === "USER_NOTES" && (
        <p className="rounded-xl bg-surface-elevated p-3 text-[13px] text-muted-foreground">
          Your imported notes — not medical guidance, and not verified against clinical sources.
        </p>
      )}

      <div className="flex flex-col divide-y divide-border-soft rounded-2xl border border-border-soft bg-surface">
        {doc.sections.map((s) => (
          <div key={s.id} className="p-5">
            <h2 className="font-medium text-foreground">{s.heading}</h2>
            {/* Rendered as plain text on purpose — imported content is never interpreted as HTML,
                so no sanitizer is needed and no script/markup from an import can ever execute. */}
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{s.content}</p>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
