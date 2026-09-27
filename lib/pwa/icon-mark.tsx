import type { ReactElement } from "react";

// Shared JSX for every generated app icon (favicon, apple-touch-icon, and the
// manifest's 192/512/512-maskable PNGs) — rendered via next/og's
// ImageResponse (Satori), so only a small subset of CSS is supported
// (flexbox + a handful of properties, no `grid`, no percentage font-size) —
// everything here is computed in absolute pixels from the target `size`.
//
// `paddingRatio` controls how much breathing room surrounds the mark —
// maskable icons need extra padding since the OS applies its own mask shape
// and can crop right up to the edge.
export function IconMark({ size, paddingRatio = 0.16 }: { size: number; paddingRatio?: number }): ReactElement {
  const inset = Math.round(size * paddingRatio);
  const innerSize = size - inset * 2;
  const borderWidth = Math.max(2, Math.round(size * 0.016));
  const fontSize = Math.round(innerSize * 0.52);

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#090d14",
      }}
    >
      <div
        style={{
          width: innerSize,
          height: innerSize,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: Math.round(innerSize * 0.22),
          background: "#10161f",
          border: `${borderWidth}px solid #3aa3ff`,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize,
            fontWeight: 700,
            color: "#3aa3ff",
          }}
        >
          M
        </div>
      </div>
    </div>
  );
}
