// Shared contract for every schematic organ graphic under components/body/organs/.
// Each organ is a small, independently authored SVG fragment centered on its
// own local origin (0,0) — the caller positions it with a <g transform="translate(x,y)">
// and sets `color` (via CSS `color`, consumed as `currentColor` inside) plus
// `emphasis` for the dim/normal/highlighted visual states. Deliberately
// schematic line-art, not anatomical tracing — see docs/DATA_MODEL.md,
// "Body Explorer redesign."
export type OrganEmphasis = "dim" | "normal" | "highlighted";

export interface OrganProps {
  emphasis: OrganEmphasis;
}

export function organOpacity(emphasis: OrganEmphasis): number {
  if (emphasis === "highlighted") return 1;
  if (emphasis === "normal") return 0.55;
  return 0.22;
}
