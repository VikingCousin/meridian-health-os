"use client";

import Link from "next/link";
import { BodySystem, BodySystemId } from "@/types/health";
import { SYSTEM_ICONS } from "@/components/body/system-icons";
import { getSystemColorVar, getSystemSoftColorVar } from "@/lib/colors";
import { cn } from "@/lib/utils";

/**
 * The system selector: a vertical rail of connected system rows on desktop
 * (lg+), the same data rendered as a horizontally-scrollable chip carousel
 * on mobile — one component, two layouts, so selection state and styling
 * never drift apart between breakpoints.
 */
export function SystemRail({
  systems,
  activeId,
  hoveredId,
  onHover,
}: {
  systems: BodySystem[];
  activeId?: BodySystemId;
  hoveredId?: BodySystemId | null;
  onHover?: (id: BodySystemId | null) => void;
}) {
  return (
    <nav
      aria-label="Body systems"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0 lg:pb-0"
    >
      {systems.map((system) => {
        const Icon = SYSTEM_ICONS[system.id];
        const active = system.id === activeId;
        const hovered = system.id === hoveredId;
        const color = getSystemColorVar(system.id);
        const disabled = !system.hasDetailPage;

        return (
          <Link
            key={system.id}
            href={disabled ? "#" : `/body/${system.id}`}
            aria-disabled={disabled}
            aria-current={active ? "page" : undefined}
            onClick={(e) => disabled && e.preventDefault()}
            onMouseEnter={() => onHover?.(system.id)}
            onMouseLeave={() => onHover?.(null)}
            className={cn(
              "group relative flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg border px-3 py-2.5 text-sm transition-all lg:whitespace-normal",
              active
                ? "border-transparent bg-surface-elevated shadow-[inset_2px_0_0_0_var(--tw-shadow-color)]"
                : "border-border-soft bg-surface hover:border-border hover:bg-surface-elevated",
              disabled && "cursor-default opacity-50 hover:bg-surface hover:border-border-soft",
              hovered && !active && "border-border"
            )}
            style={active ? ({ "--tw-shadow-color": color } as React.CSSProperties) : undefined}
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
              style={{ background: getSystemSoftColorVar(system.id), color }}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
            </span>
            <span className={cn("font-medium", active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
              {system.shortLabel}
            </span>
            {!disabled && (
              <span
                className="ml-auto hidden h-1.5 w-1.5 shrink-0 rounded-full lg:block"
                style={{ background: color, opacity: active || hovered ? 1 : 0.35 }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
