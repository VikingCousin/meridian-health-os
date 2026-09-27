import { BodySystem } from "@/types/health";
import { StatusPill } from "@/components/health/status-pill";
import { SYSTEM_ICONS } from "@/components/body/system-icons";
import { getSystemColorVar, getSystemSoftColorVar } from "@/lib/colors";
import { getAppSettings } from "@/lib/services/settings.service";
import { getRealBodySystemStatus } from "@/lib/services/body-system-status.service";

// Async server component — see body-system-card.tsx for why: real mode
// never shows the demo dataset's fabricated per-system status/summary.
export async function SystemPanelHeader({ system }: { system: BodySystem }) {
  const settings = await getAppSettings();
  const { status, summary } = settings.demoMode
    ? { status: system.status, summary: system.summary }
    : await getRealBodySystemStatus(system.id);

  const Icon = SYSTEM_ICONS[system.id];
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-soft pb-4">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ background: getSystemSoftColorVar(system.id), color: getSystemColorVar(system.id) }}
        >
          <Icon className="h-5 w-5" strokeWidth={1.6} />
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground">{system.name}</h2>
          <p className="max-w-sm text-[13px] text-muted-foreground">{summary}</p>
        </div>
      </div>
      <StatusPill status={status} />
    </div>
  );
}
