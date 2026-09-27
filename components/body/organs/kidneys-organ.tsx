import { organOpacity, type OrganProps } from "./types";

function KidneyBean({ x }: { x: number }) {
  // A single bean/kidney shape — the concave inner edge is what makes a
  // kidney glyph immediately readable even at small, schematic scale.
  return (
    <path
      transform={`translate(${x}, 0)`}
      d="M -6 -12 C -13 -10 -14 4 -8 10 C -3 15 6 13 8 5 C 5 4 3 1 4 -2 C 5 -6 8 -6 9 -9 C 6 -13 0 -14 -6 -12 Z"
      fill="currentColor"
      fillOpacity="0.24"
      stroke="currentColor"
      strokeWidth="1.3"
    />
  );
}

export function KidneysOrgan({ emphasis }: OrganProps) {
  const opacity = organOpacity(emphasis);
  return (
    <g style={{ opacity }} className="transition-opacity duration-500">
      <KidneyBean x={-12} />
      <g transform="scale(-1,1)">
        <KidneyBean x={-12} />
      </g>
    </g>
  );
}
