"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { CoachTurn } from "@/components/coach/coach-turn";
import { askCoachAction } from "@/lib/actions/coach";
import { useTranslations } from "@/lib/i18n/locale-provider";
import type { CoachResponse } from "@/lib/coach/types";
import { Send, ArrowRight, CalendarClock } from "lucide-react";

const STARTER_QUESTIONS = [
  "What should I focus on this week?",
  "Why has my recovery been worse?",
  "What patterns are affecting my sleep?",
  "What should I test next?",
  "How am I progressing toward my goals?",
  "Which intervention is highest leverage right now?",
];

interface Turn {
  id: string;
  question: string;
  response: CoachResponse;
}

function CoachChat() {
  const { t } = useTranslations();
  const searchParams = useSearchParams();
  const initialQuestion = searchParams.get("q");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const askedInitial = useRef(false);

  const ask = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    setInput("");
    setThinking(true);
    const result = await askCoachAction({ question: trimmed });
    setThinking(false);
    if (!result.ok) return;
    setTurns((prev) => [...prev, { id: `t-${Date.now()}`, question: trimmed, response: result.response }]);
  };

  useEffect(() => {
    if (initialQuestion && !askedInitial.current) {
      askedInitial.current = true;
      void ask(initialQuestion);
    }
  }, [initialQuestion]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, thinking]);

  const lastFollowUps = turns[turns.length - 1]?.response.suggestedFollowUpQuestions ?? [];

  return (
    <PageContainer className="animate-fade-in-up flex-1">
      <PageHeader
        eyebrow="Health Coach"
        title="Coach"
        description="Ask about your data, goals, recovery, training, sleep, or experiments — every answer traces back to real records."
        action={
          <Link href="/coach/plan" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
            <CalendarClock className="h-4 w-4" /> This week&apos;s plan
          </Link>
        }
      />

      <div className="flex flex-1 flex-col rounded-2xl border border-border-soft bg-surface">
        <div ref={scrollRef} className="flex max-h-[65vh] min-h-[280px] flex-col gap-6 overflow-y-auto p-5">
          {turns.length === 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">Try asking:</p>
              <div className="flex flex-col gap-2">
                {STARTER_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => void ask(q)}
                    className="flex items-center justify-between rounded-xl border border-border-soft bg-surface-muted/60 px-4 py-3 text-left text-sm hover:bg-surface-muted"
                  >
                    {q}
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((t) => (
            <CoachTurn key={t.id} question={t.question} response={t.response} />
          ))}

          {thinking && (
            <div className="flex items-center gap-1.5 self-start rounded-2xl border border-border-soft bg-surface-muted/50 px-4 py-3">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.2s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0.2s]" />
            </div>
          )}

          {!thinking && lastFollowUps.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {lastFollowUps.map((q) => (
                <button
                  key={q}
                  onClick={() => void ask(q)}
                  className="rounded-full border border-border-soft bg-surface-muted/50 px-3 py-1.5 text-[12px] text-muted-foreground hover:bg-surface-muted"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border-soft p-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void ask(input)}
            placeholder={t("coach.placeholder")}
            className="flex-1 rounded-full border border-border-soft bg-surface-muted/40 px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <button
            onClick={() => void ask(input)}
            disabled={!input.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </PageContainer>
  );
}

export default function CoachPage() {
  return (
    <Suspense>
      <CoachChat />
    </Suspense>
  );
}
