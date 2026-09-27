import { organOpacity, type OrganProps } from "./types";

export function GutOrgan({ emphasis }: OrganProps) {
  const opacity = organOpacity(emphasis);
  return (
    <g style={{ opacity }} className="transition-opacity duration-500">
      {/* a simple coiled loop — the most recognizable schematic shorthand for intestine, without literal tracing */}
      <path
        d="M -22 -14 C -22 -20 -10 -20 -10 -14 C -10 -9 -18 -9 -18 -4 C -18 1 -4 1 -4 -6 C -4 -12 6 -12 6 -5 C 6 0 -2 2 0 8 C 2 14 16 14 18 6 C 20 -2 10 -4 4 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M -22 -14 C -22 -20 -10 -20 -10 -14 C -10 -9 -18 -9 -18 -4 C -18 1 -4 1 -4 -6 C -4 -12 6 -12 6 -5 C 6 0 -2 2 0 8 C 2 14 16 14 18 6 C 20 -2 10 -4 4 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.35"
      />
    </g>
  );
}
