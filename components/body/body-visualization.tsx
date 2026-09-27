"use client";

import { useState } from "react";
import Link from "next/link";
import { BodySystem, BodySystemId } from "@/types/health";
import { getSystemColorVar } from "@/lib/colors";
import { SYSTEM_ICONS } from "@/components/body/system-icons";
import { ORGAN_COMPONENTS, organOpacity, type OrganEmphasis } from "@/components/body/organs";
import { cn } from "@/lib/utils";

const HOTSPOTS: { id: BodySystemId; x: number; y: number; labelSide?: "left" | "right" }[] = [
  { id: "brain", x: 120, y: 44, labelSide: "right" },
  { id: "lungs", x: 120, y: 128, labelSide: "right" },
  { id: "cardiovascular", x: 100, y: 158, labelSide: "left" },
  { id: "liver", x: 92, y: 192, labelSide: "left" },
  { id: "kidneys", x: 154, y: 206, labelSide: "right" },
  { id: "gut", x: 122, y: 238, labelSide: "right" },
  { id: "metabolic", x: 122, y: 272, labelSide: "left" },
  { id: "immune", x: 122, y: 340, labelSide: "right" },
  { id: "musculoskeletal", x: 122, y: 422, labelSide: "left" },
];

const SILHOUETTE = {
  head: { cx: 120, cy: 50, rx: 30, ry: 36 },
  neck: "M106,80 L106,96 C106,104 134,104 134,96 L134,80 Z",
  torso:
    "M62,112 C55,135 55,150 58,155 C50,180 74,200 82,215 C72,235 62,248 68,260 C70,272 74,280 78,285 L162,285 C166,280 170,272 172,260 C178,248 168,235 158,215 C166,200 190,180 182,155 C185,150 185,135 178,112 C160,100 80,100 62,112 Z",
  armLeft:
    "M58,118 C40,150 30,190 32,215 C28,250 24,280 22,300 C20,315 18,325 18,335 L40,335 C40,320 42,305 44,295 C46,270 50,235 52,210 C54,180 62,150 78,125 C70,120 64,118 58,118 Z",
  armRight:
    "M182,118 C200,150 210,190 208,215 C212,250 216,280 218,300 C220,315 222,325 222,335 L200,335 C200,320 198,305 196,295 C194,270 190,235 188,210 C186,180 178,150 162,125 C170,120 176,118 182,118 Z",
  legLeft:
    "M78,285 C70,340 66,400 68,450 C69,480 68,500 62,515 C60,522 62,528 70,530 L96,530 C100,522 99,512 98,500 C100,460 104,400 106,350 C108,320 110,300 112,288 C100,282 86,282 78,285 Z",
  legRight:
    "M162,285 C170,340 174,400 172,450 C171,480 172,500 178,515 C180,522 178,528 170,530 L144,530 C140,522 141,512 142,500 C140,460 136,400 134,350 C132,320 130,300 128,288 C140,282 154,282 162,285 Z",
};

/**
 * Body Explorer redesign: the silhouette now hosts small schematic organ
 * glyphs (components/body/organs/) at each system's anatomical position,
 * instead of a plain colored dot. Selecting/hovering a system dims every
 * other organ and brings that one to full opacity + a status ring — the
 * dot-based status language becomes secondary (a small ring), not the only
 * representation of anatomy. See docs/DATA_MODEL.md, "Body Explorer redesign."
 */
export function BodyVisualization({
  systems,
  compact = false,
  activeId,
  hoveredId: hoveredIdProp,
  onHover,
}: {
  systems: BodySystem[];
  compact?: boolean;
  activeId?: BodySystemId;
  hoveredId?: BodySystemId | null;
  onHover?: (id: BodySystemId | null) => void;
}) {
  const [internalHovered, setInternalHovered] = useState<BodySystemId | null>(null);
  const hovered = hoveredIdProp !== undefined ? hoveredIdProp : internalHovered;
  const setHovered = onHover ?? setInternalHovered;
  const systemById = (id: BodySystemId) => systems.find((s) => s.id === id);
  // Once anything is selected/hovered, everything else recedes — otherwise
  // every organ sits at its normal, legible resting opacity.
  const anyEmphasized = activeId !== undefined || hovered !== null;

  return (
    <div className="relative mx-auto w-full max-w-[160px] sm:max-w-[200px] lg:max-w-[380px]" style={{ aspectRatio: "240 / 560" }}>
      <svg viewBox="0 0 240 560" className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          {HOTSPOTS.map((h) => (
            <radialGradient key={h.id} id={`glow-${h.id}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={getSystemColorVar(h.id)} stopOpacity="0.55" />
              <stop offset="100%" stopColor={getSystemColorVar(h.id)} stopOpacity="0" />
            </radialGradient>
          ))}
        </defs>

        {/* soft highlight glow: stronger + persistent for the active (selected) system, transient for hover */}
        {HOTSPOTS.map((h) => {
          const isActive = activeId === h.id;
          const isHovered = hovered === h.id;
          const r = isActive ? 66 : isHovered ? 54 : 0;
          return (
            <circle
              key={`glow-circle-${h.id}`}
              cx={h.x}
              cy={h.y}
              r={r}
              fill={`url(#glow-${h.id})`}
              opacity={isActive ? 1 : 0.85}
              className="transition-all duration-500 ease-out"
            />
          );
        })}

        {/* silhouette */}
        <g fill="var(--surface-elevated)" stroke="var(--border)" strokeWidth="1.5">
          <path d={SILHOUETTE.legLeft} />
          <path d={SILHOUETTE.legRight} />
          <path d={SILHOUETTE.armLeft} />
          <path d={SILHOUETTE.armRight} />
          <path d={SILHOUETTE.torso} />
          <ellipse cx={SILHOUETTE.head.cx} cy={SILHOUETTE.head.cy} rx={SILHOUETTE.head.rx} ry={SILHOUETTE.head.ry} />
          <path d={SILHOUETTE.neck} />
        </g>

        {/* schematic organs — each dims/brightens with hover+selection, layered above the silhouette */}
        {HOTSPOTS.map((h) => {
          const Organ = ORGAN_COMPONENTS[h.id];
          const isActive = activeId === h.id;
          const isHovered = hovered === h.id;
          const emphasis: OrganEmphasis = isActive || isHovered ? "highlighted" : anyEmphasized ? "dim" : "normal";
          return (
            <g key={`organ-${h.id}`} transform={`translate(${h.x}, ${h.y})`} style={{ color: getSystemColorVar(h.id) }}>
              <Organ emphasis={emphasis} />
            </g>
          );
        })}

        {/* status ring — the secondary indicator language, small and off to the side of each organ */}
        {!compact &&
          HOTSPOTS.map((h) => {
            const isActive = activeId === h.id;
            const isHovered = hovered === h.id;
            const isEmphasized = isActive || isHovered;
            return (
              <circle
                key={`status-ring-${h.id}`}
                cx={h.x + 20}
                cy={h.y - 18}
                r={isEmphasized ? 4.5 : 3.5}
                fill="var(--surface)"
                stroke={getSystemColorVar(h.id)}
                strokeWidth="2"
                opacity={isEmphasized ? 1 : organOpacity(anyEmphasized ? "dim" : "normal")}
                className="transition-all duration-500"
              />
            );
          })}
      </svg>

      {/* hotspots: HTML overlay so the whole organ region is one clickable/focusable hit target */}
      {HOTSPOTS.map((h) => {
        const system = systemById(h.id);
        if (!system) return null;
        const Icon = SYSTEM_ICONS[h.id];
        const isActive = activeId === h.id;
        const isHovered = hovered === h.id;
        const isEmphasized = isActive || isHovered;
        const leftPct = (h.x / 240) * 100;
        const topPct = (h.y / 560) * 100;
        const side = h.labelSide ?? "right";

        return (
          <Link
            key={h.id}
            href={system.hasDetailPage ? `/body/${h.id}` : "/body"}
            aria-current={isActive ? "page" : undefined}
            aria-label={`${system.name}${system.hasDetailPage ? "" : " (no detail page yet)"}`}
            onMouseEnter={() => setHovered(h.id)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(h.id)}
            onBlur={() => setHovered(null)}
            className="absolute flex items-center gap-2 focus-visible:outline-none"
            style={{
              left: `${leftPct}%`,
              top: `${topPct}%`,
              transform: "translate(-50%, -50%)",
              // A generous, consistent touch target regardless of each organ
              // glyph's own (irregular) footprint — matters most on iPhone.
              width: compact ? 28 : 56,
              height: compact ? 28 : 56,
              justifyContent: "center",
            }}
          >
            {!compact && (
              <div
                className={cn(
                  "pointer-events-none absolute hidden items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-surface-elevated/95 px-2.5 py-1 text-xs font-medium shadow-lg backdrop-blur transition-all lg:flex",
                  isEmphasized ? "opacity-100 scale-100" : "opacity-0 scale-95",
                  side === "left" ? "right-full mr-2" : "left-full ml-2"
                )}
                style={{ color: isEmphasized ? getSystemColorVar(h.id) : undefined }}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                {system.shortLabel}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
