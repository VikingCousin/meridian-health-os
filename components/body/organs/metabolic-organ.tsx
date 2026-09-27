import { organOpacity, type OrganProps } from "./types";

/**
 * Metabolic health has no single organ — this is a deliberately abstract
 * glyph (a hexagon, evoking a molecule/cell, with a small energy spark
 * inside) rather than a fabricated anatomical structure. Positioned near
 * the liver/gut in the abdomen, where most of the app's metabolic
 * biomarkers (glucose, body composition) are conceptually anchored.
 */
export function MetabolicOrgan({ emphasis }: OrganProps) {
  const opacity = organOpacity(emphasis);
  return (
    <g style={{ opacity }} className="transition-opacity duration-500">
      <path
        d="M 0 -16 L 14 -8 L 14 8 L 0 16 L -14 8 L -14 -8 Z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M 2 -8 L -4 2 L 1 2 L -2 9 L 7 -1 L 2 -1 Z" fill="currentColor" fillOpacity="0.6" />
    </g>
  );
}
