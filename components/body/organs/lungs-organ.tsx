import { organOpacity, type OrganProps } from "./types";

export function LungsOrgan({ emphasis }: OrganProps) {
  const opacity = organOpacity(emphasis);
  return (
    <g style={{ opacity }} className="transition-opacity duration-500">
      {/* trachea + bronchi */}
      <path d="M 0 -22 L 0 -4 M 0 -4 C -6 -2 -12 2 -14 8 M 0 -4 C 6 -2 12 2 14 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      {/* left lobe */}
      <path
        d="M -4 -2 C -14 -4 -26 2 -27 16 C -28 26 -18 30 -10 26 C -4 23 -2 10 -4 -2 Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      {/* right lobe (slightly larger, anatomically typical) */}
      <path
        d="M 4 -2 C 15 -5 29 1 30 16 C 31 27 20 31 12 27 C 5 24 3 10 4 -2 Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </g>
  );
}
