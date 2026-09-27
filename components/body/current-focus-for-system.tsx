import { CurrentFocusPanel } from "@/components/coach/current-focus-panel";
import { getCurrentFocusForSystem } from "@/lib/services/coach-priority.service";
import type { BodySystemId } from "@/types/health";

/** Max 1-2 relevant priorities per system — see docs/COACH_ARCHITECTURE.md, "Body integration." */
export async function CurrentFocusForSystem({ system }: { system: BodySystemId }) {
  const items = await getCurrentFocusForSystem(system, 2);
  if (items.length === 0) return null;
  return <CurrentFocusPanel items={items} compact />;
}
