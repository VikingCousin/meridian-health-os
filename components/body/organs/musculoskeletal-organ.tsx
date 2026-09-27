import { organOpacity, type OrganProps } from "./types";

/**
 * Represents the joint + muscle-fiber system schematically at a hip/thigh
 * anchor point — a joint ring plus a few fiber striations, rather than
 * tracing individual named muscles.
 */
export function MusculoskeletalOrgan({ emphasis }: OrganProps) {
  const opacity = organOpacity(emphasis);
  return (
    <g style={{ opacity }} className="transition-opacity duration-500">
      <circle cx="0" cy="-10" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="0" cy="-10" r="3" fill="currentColor" fillOpacity="0.5" />
      {/* muscle-fiber striations fanning down from the joint */}
      <path d="M -10 4 L -14 22 M -4 6 L -6 24 M 2 6 L 3 24 M 8 4 L 13 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
    </g>
  );
}
