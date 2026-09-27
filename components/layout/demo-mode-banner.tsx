import { FlaskConical } from "lucide-react";
import { getAppSettings } from "@/lib/services/settings.service";

// Phase 7 demo-mode transparency: makes the existing demo/real data
// isolation (dataSourceId presence on BiomarkerMeasurement, see
// docs/WEARABLE_ARCHITECTURE.md) visible in the UI rather than implicit.
export async function DemoModeBanner({ profileName }: { profileName: string }) {
  const settings = await getAppSettings();
  if (!settings.demoMode) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-gold-soft px-4 py-1.5 text-center text-[11px] font-medium text-gold">
      <FlaskConical className="h-3.5 w-3.5 shrink-0" />
      DEMO MODE — {profileName} · Synthetic data. Turn off in Profile → Data Management.
    </div>
  );
}
