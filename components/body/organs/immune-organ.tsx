import { organOpacity, type OrganProps } from "./types";

const NODES = [
  { x: -16, y: -10 },
  { x: 14, y: -12 },
  { x: -8, y: 6 },
  { x: 10, y: 10 },
];

export function ImmuneOrgan({ emphasis }: OrganProps) {
  const opacity = organOpacity(emphasis);
  return (
    <g style={{ opacity }} className="transition-opacity duration-500">
      {/* lymphatic vessels — thin connecting lines between nodes, schematic not literal anatomy */}
      <path d="M -16 -10 L -8 6 L 10 10 L 14 -12 L -8 6" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      {/* small spleen bean, upper-left */}
      <path d="M -20 -16 C -25 -14 -25 -6 -20 -4 C -15 -3 -12 -10 -14 -15 C -16 -18 -18 -18 -20 -16 Z" fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeWidth="1.2" />
      {NODES.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r="3.2" fill="currentColor" fillOpacity="0.5" stroke="currentColor" strokeWidth="1" />
      ))}
    </g>
  );
}
