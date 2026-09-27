import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The instrument-panel building block: a Card with an optional eyebrow
 * label + status light, optional corner ticks, and optional grid background.
 * Used anywhere the UI should read as "a panel on a control surface" rather
 * than "a card in a list."
 */
function TechnicalPanel({
  className,
  eyebrow,
  statusDotClassName,
  corners = false,
  grid = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  eyebrow?: React.ReactNode;
  statusDotClassName?: string;
  corners?: boolean;
  grid?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border-soft bg-surface",
        corners && "corner-ticks",
        className
      )}
      {...props}
    >
      {grid && <div className="bg-grid bg-grid-fade pointer-events-none absolute inset-0 opacity-40" />}
      {eyebrow && (
        <div className="relative flex items-center gap-2 border-b border-border-soft px-4 py-2.5">
          {statusDotClassName && <span className={cn("h-1.5 w-1.5 rounded-full", statusDotClassName)} />}
          <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {eyebrow}
          </span>
        </div>
      )}
      <div className="relative">{children}</div>
    </div>
  );
}

export { TechnicalPanel };
