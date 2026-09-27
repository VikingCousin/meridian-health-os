import { organOpacity, type OrganProps } from "./types";

export function LiverOrgan({ emphasis }: OrganProps) {
  const opacity = organOpacity(emphasis);
  return (
    <g style={{ opacity }} className="transition-opacity duration-500">
      {/* the two-lobed wedge silhouette liver is commonly recognized by, larger lobe toward center */}
      <path
        d="M -26 -8 C -20 -16 -2 -18 10 -12 C 22 -7 26 2 20 9 C 14 15 -6 16 -18 10 C -27 5 -30 -2 -26 -8 Z"
        fill="currentColor"
        fillOpacity="0.22"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M -8 -10 C -4 -4 -2 3 -6 9" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
    </g>
  );
}
