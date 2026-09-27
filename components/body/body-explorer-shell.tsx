"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { BodySystem, BodySystemId } from "@/types/health";
import { BodyVisualization } from "@/components/body/body-visualization";
import { SystemRail } from "@/components/body/system-rail";
import { TechnicalPanel } from "@/components/ui/technical-panel";

/**
 * The persistent Body-page chrome: the anatomy figure and the system rail
 * stay mounted across `/body` <-> `/body/[system]` navigations (this lives
 * in app/body/layout.tsx), while `children` — the selected system's detail
 * panel — is whatever page.tsx Next.js resolved for the current route.
 * Hover state is shared between the anatomy hotspots and the rail so
 * pointing at either highlights both — the "connectedness" the redesign
 * calls for, without needing to measure DOM positions for literal connector lines.
 */
export function BodyExplorerShell({ systems, children }: { systems: BodySystem[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const [hoveredId, setHoveredId] = useState<BodySystemId | null>(null);
  const activeId = pathname.startsWith("/body/") ? (pathname.split("/")[2] as BodySystemId) : undefined;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,380px)_1fr] lg:items-start lg:gap-8">
      {/* Rail: horizontal carousel on mobile (order-2, below anatomy), vertical on desktop (order-1, left column) */}
      <div className="order-2 lg:order-1 lg:sticky lg:top-6">
        <SystemRail systems={systems} activeId={activeId} hoveredId={hoveredId} onHover={setHoveredId} />
      </div>

      {/* Anatomy */}
      <div className="order-1 lg:order-2 lg:sticky lg:top-6">
        <TechnicalPanel grid className="py-4 lg:py-8">
          <BodyVisualization systems={systems} activeId={activeId} hoveredId={hoveredId} onHover={setHoveredId} />
        </TechnicalPanel>
      </div>

      {/* Detail panel */}
      <div className="order-3 min-w-0">{children}</div>
    </div>
  );
}
