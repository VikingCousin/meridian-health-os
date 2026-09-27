"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { runAnalysisAction } from "@/lib/actions/insights";
import { RefreshCw } from "lucide-react";

export function RunAnalysisButton() {
  const [isPending, startTransition] = useTransition();
  const [lastRun, setLastRun] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await runAnalysisAction();
            setLastRun(
              `${result.summary.insightsCreated} new, ${result.summary.insightsUpdated} updated (${result.summary.candidatesEvaluated} candidates checked)`
            );
            router.refresh();
          })
        }
      >
        <RefreshCw className={isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        {isPending ? "Analyzing…" : "Analyze my health data"}
      </Button>
      {lastRun && <p className="text-[11px] text-muted-foreground">{lastRun}</p>}
    </div>
  );
}
