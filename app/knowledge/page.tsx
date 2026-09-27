import Link from "next/link";
import { BookOpen, FileText, UploadCloud } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getKnowledgeLibrary } from "@/lib/knowledge/knowledge.service";
import { format } from "date-fns";

const SOURCE_VARIANT: Record<string, "gold" | "accent" | "neutral" | "outline" | "info"> = {
  CURATED: "gold",
  USER_NOTES: "accent",
  NOTEBOOKLM_EXPORT: "info",
  GUIDELINE: "outline",
  RESEARCH_SUMMARY: "neutral",
  OTHER: "neutral",
};

const SOURCE_LABEL: Record<string, string> = {
  CURATED: "Curated",
  USER_NOTES: "Your notes",
  NOTEBOOKLM_EXPORT: "Imported export",
  GUIDELINE: "Guideline",
  RESEARCH_SUMMARY: "Research summary",
  OTHER: "Other source",
};

export default async function KnowledgeLibraryPage() {
  const documents = await getKnowledgeLibrary();

  return (
    <PageContainer className="animate-fade-in-up">
      <PageHeader
        eyebrow="Knowledge"
        title="Health Knowledge Library"
        description="General health information — curated notes and anything you import. Kept separate from your personal data and insights; the Coach cites this, it never treats it as evidence about you."
        action={
          <Button asChild>
            <Link href="/knowledge/import">
              <UploadCloud className="h-4 w-4" /> Import notes
            </Link>
          </Button>
        }
      />

      {documents.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-12 text-center">
          <BookOpen className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
          <p className="font-medium">No knowledge documents yet</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Import a Markdown or text file — your own notes, a NotebookLM export, or a guideline — to build your library.
          </p>
          <Button asChild className="mt-2">
            <Link href="/knowledge/import">Import your first document</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {documents.map((doc) => (
            <Link
              key={doc.id}
              href={`/knowledge/${doc.id}`}
              className="flex flex-col gap-2 rounded-2xl border border-border-soft bg-surface p-5 transition-colors hover:border-accent/40"
            >
              <div className="flex items-start justify-between gap-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Badge variant={SOURCE_VARIANT[doc.sourceType] ?? "neutral"}>{SOURCE_LABEL[doc.sourceType] ?? doc.sourceType}</Badge>
              </div>
              <h3 className="font-medium leading-snug text-foreground">{doc.title}</h3>
              <p className="text-xs text-muted-foreground">
                {doc.chunkCount} section{doc.chunkCount === 1 ? "" : "s"}
                {doc.bodySystem ? ` · ${doc.bodySystem.toLowerCase()}` : ""}
                {doc.topic ? ` · ${doc.topic}` : ""}
              </p>
              <p className="text-[11px] text-muted-foreground/70">Imported {format(doc.createdAt, "d MMM yyyy")}</p>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
