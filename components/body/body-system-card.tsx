import Link from "next/link";
import { BodySystem } from "@/types/health";
import { StatusPill } from "@/components/health/status-pill";
import { ChevronRight } from "lucide-react";
import { getSystemColorVar, getSystemSoftColorVar } from "@/lib/colors";
import { SYSTEM_ICONS } from "@/components/body/system-icons";
import { getAppSettings } from "@/lib/services/settings.service";
import { getRealBodySystemStatus } from "@/lib/services/body-system-status.service";

// Async server component: in real mode, the demo dataset's fabricated
// per-system status/summary is replaced by a plain data-presence fact
// (see body-system-status.service.ts) rather than shown unconditionally.
export async function BodySystemCard({ system, compact = false }: { system: BodySystem; compact?: boolean }) {
  const settings = await getAppSettings();
  const { status, summary } = settings.demoMode
    ? { status: system.status, summary: system.summary }
    : await getRealBodySystemStatus(system.id);

  const Icon = SYSTEM_ICONS[system.id];
  const href = system.hasDetailPage ? `/body/${system.id}` : `/body?highlight=${system.id}`;

  return (
    <Link
      href={href}
      className="group flex items-center gap-3.5 rounded-xl border border-border-soft bg-surface p-3.5 transition-all hover:border-border hover:shadow-sm"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{ background: getSystemSoftColorVar(system.id), color: getSystemColorVar(system.id) }}
      >
        <Icon className="h-5 w-5" strokeWidth={1.6} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{system.shortLabel}</p>
        {!compact && <p className="mt-0.5 truncate text-xs text-muted-foreground">{summary}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusPill status={status} />
        <ChevronRight className="h-4 w-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
