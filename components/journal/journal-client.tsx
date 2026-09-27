"use client";

import { useState, useTransition } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { JournalEntryCard } from "@/components/journal/journal-entry-card";
import { createJournalEntryAction } from "@/lib/actions/journal";
import { JournalEntry } from "@/types/health";
import { Sparkles, XCircle } from "lucide-react";

export function JournalClient({ initialEntries }: { initialEntries: JournalEntry[] }) {
  const [entries, setEntries] = useState<JournalEntry[]>(initialEntries);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    const text = draft.trim();
    if (!text) return;
    setError(null);
    startTransition(async () => {
      const result = await createJournalEntryAction({ text });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEntries((prev) => [result.entry, ...prev]);
      setDraft("");
    });
  };

  return (
    <PageContainer className="animate-fade-in-up">
      <PageHeader
        eyebrow="Reflect"
        title="Journal"
        description="Write freely. Meridian looks for patterns without changing a word of what you wrote."
      />

      <div className="rounded-2xl border border-border-soft bg-surface p-5">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="What's on your mind?"
          rows={4}
          className="w-full resize-none bg-transparent text-[15px] leading-relaxed placeholder:text-muted-foreground/70 focus:outline-none"
        />
        <div className="mt-3 flex items-center justify-between border-t border-border-soft pt-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Meridian will suggest tags after you save
          </span>
          <Button onClick={handleSubmit} disabled={!draft.trim() || isPending} size="sm">
            {isPending ? "Saving…" : "Save entry"}
          </Button>
        </div>
        {error && (
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-danger">
            <XCircle className="h-3.5 w-3.5" /> {error}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {entries.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No journal entries yet — write your first one above.
          </div>
        )}
        {entries.map((entry) => (
          <JournalEntryCard key={entry.id} entry={entry} />
        ))}
      </div>
    </PageContainer>
  );
}
