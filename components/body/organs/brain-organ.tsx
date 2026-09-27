import { organOpacity, type OrganProps } from "./types";

export function BrainOrgan({ emphasis }: OrganProps) {
  const opacity = organOpacity(emphasis);
  return (
    <g style={{ opacity }} className="transition-opacity duration-500">
      <path
        d="M -20 2 C -22 -10 -12 -16 -4 -14 C 0 -18 8 -18 12 -13 C 20 -13 22 -2 18 4 C 22 10 18 18 10 18 C 8 21 -2 21 -5 18 C -14 20 -22 14 -20 6 Z"
        fill="currentColor"
        fillOpacity="0.22"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      {/* sulci — a couple of soft wrinkle lines, purely schematic */}
      <path d="M -14 -4 C -8 -8 -2 -6 2 -8" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
      <path d="M -10 4 C -4 1 4 3 10 -1" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
      <path d="M -6 12 C 0 9 6 11 12 8" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
    </g>
  );
}
