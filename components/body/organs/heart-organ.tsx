import { organOpacity, type OrganProps } from "./types";

export function HeartOrgan({ emphasis }: OrganProps) {
  const opacity = organOpacity(emphasis);
  return (
    <g style={{ opacity }} className="transition-opacity duration-500">
      <path
        d="M 0 14 C -14 4 -16 -8 -8 -12 C -3 -14 0 -11 0 -8 C 0 -11 3 -14 8 -12 C 16 -8 14 4 0 14 Z"
        fill="currentColor"
        fillOpacity="0.28"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* a simple pulse line through the middle — subtle, iconic, not a real ECG */}
      <path d="M -14 -1 L -6 -1 L -3 -7 L 1 5 L 4 -1 L 14 -1" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
    </g>
  );
}
