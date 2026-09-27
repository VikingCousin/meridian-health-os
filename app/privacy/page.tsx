import Link from "next/link";
import { ChevronLeft, ShieldCheck, Radio } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { getAppSettings } from "@/lib/services/settings.service";

const LOCAL_ONLY = [
  { title: "Deterministic analytics & insights", detail: "Baselines, trends, and exposure/outcome associations — plain TypeScript against your local database, never sent anywhere." },
  { title: "Wearable import parsing", detail: "Amazfit/Zepp and CSV exports are parsed in memory in this process. No file is ever uploaded to a third party." },
  { title: "Knowledge search", detail: "Lexical keyword/heading matching over your local knowledge library — no embeddings, no external call." },
  { title: "Coach prioritization", detail: "Context building, candidate generation, scoring, and the safety classifier are all local — the LLM never decides what to prioritize." },
  { title: "Manual lab entry & journal (AI off)", detail: "Fully usable without any external call — see the External AI toggle below." },
];

const EXTERNAL_WHEN_ENABLED = [
  { title: "Lab document extraction", detail: "Sends the uploaded document's bytes to your configured provider (Anthropic/OpenAI) for one extraction call." },
  { title: "Journal observation structuring", detail: "Sends that entry's raw text for one structuring call." },
  { title: "Coach language phrasing", detail: "Sends a minimized payload — the question, safety classification, goal/pattern titles, journal category counts (never raw text), the 3 decided priorities, and 2-4 knowledge excerpts — never your full history." },
];

export default async function PrivacyDashboardPage() {
  const settings = await getAppSettings();

  return (
    <PageContainer className="animate-fade-in-up max-w-3xl">
      <Link href="/profile" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Profile
      </Link>

      <PageHeader
        eyebrow="Privacy"
        title="Privacy & data-flow dashboard"
        description="What stays on this machine, what leaves it, and only when you've turned that on."
      />

      <div className="flex items-center gap-2 rounded-xl bg-surface-muted p-4 text-sm">
        <ShieldCheck className="h-4 w-4 text-accent" />
        External AI is currently <strong className="mx-1">{settings.externalAiEnabled ? "ON" : "OFF"}</strong>
        {!settings.externalAiEnabled && "— nothing in the External AI section below runs right now."}
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Radio className="h-4 w-4" /> Local only — always
        </h2>
        <div className="flex flex-col gap-2.5">
          {LOCAL_ONLY.map((item) => (
            <div key={item.title} className="rounded-xl border border-border-soft bg-surface p-4">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          External AI — only when enabled
        </h2>
        <div className="flex flex-col gap-2.5">
          {EXTERNAL_WHEN_ENABLED.map((item) => (
            <div key={item.title} className="rounded-xl border border-border-soft bg-surface p-4">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">Full detail lives in docs/PRIVACY_ARCHITECTURE.md in the repository.</p>
    </PageContainer>
  );
}
