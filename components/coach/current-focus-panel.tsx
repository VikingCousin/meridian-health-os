import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { TechnicalPanel } from "@/components/ui/technical-panel";
import { Badge } from "@/components/ui/badge";
import type { FocusItem } from "@/lib/coach/types";

const tierLabel: Record<FocusItem["tier"], string> = { primary: "Primary", secondary: "Secondary", optional: "Optional" };
const tierVariant: Record<FocusItem["tier"], "accent" | "neutral" | "outline"> = { primary: "accent", secondary: "neutral", optional: "outline" };

/**
 * Shared "current focus" list for Home and Body — max 3 items, reused as-is
 * rather than re-implemented per surface. See docs/COACH_ARCHITECTURE.md,
 * "Home integration" / "Body integration."
 */
export function CurrentFocusPanel({ items, compact = false }: { items: FocusItem[]; compact?: boolean }) {
  if (items.length === 0) return null;

  return (
    <TechnicalPanel eyebrow={<span className="flex items-center gap-1.5"><Sparkles className="h-3 w-3" /> Current focus</span>}>
      <div className="flex flex-col divide-y divide-border-soft">
        {items.map((item) => (
          <div key={item.interventionId} className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant={tierVariant[item.tier]}>{tierLabel[item.tier]}</Badge>
                <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
              </div>
              {!compact && <p className="mt-1 text-[12px] text-muted-foreground">{item.why}</p>}
            </div>
            <Link href="/coach/plan" className="mt-0.5 shrink-0 text-muted-foreground hover:text-accent">
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ))}
      </div>
    </TechnicalPanel>
  );
}
