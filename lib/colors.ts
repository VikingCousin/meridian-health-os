import { BodySystemId } from "@/types/health";

// Reference the base tokens declared directly on :root in globals.css
// (not the Tailwind @theme aliases) — Tailwind only emits theme variables
// it can see referenced by a literal utility class name in source, and
// these colors are also consumed dynamically (inline styles, SVG, Recharts)
// where no such literal class exists.
export function getSystemColorVar(system: BodySystemId): string {
  return `var(--sys-${system})`;
}

export function getSystemSoftColorVar(system: BodySystemId): string {
  return `var(--sys-${system}-soft)`;
}
