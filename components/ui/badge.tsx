import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none w-fit",
  {
    variants: {
      variant: {
        neutral: "bg-surface-muted text-muted-foreground",
        accent: "bg-accent-soft text-accent",
        warn: "bg-warn-soft text-warn",
        danger: "bg-danger-soft text-danger",
        info: "bg-info-soft text-info",
        gold: "bg-gold-soft text-gold",
        outline: "border border-border text-muted-foreground",
        good: "bg-state-good-soft text-state-good",
        watch: "bg-state-watch-soft text-state-watch",
        elevated: "bg-state-elevated-soft text-state-elevated",
        high: "bg-state-high-soft text-state-high",
        low: "bg-state-low-soft text-state-low",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export interface BadgeProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
