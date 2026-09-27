import type { BodySystemId } from "@/types/health";
import type { OrganProps } from "./types";
import { BrainOrgan } from "./brain-organ";
import { LungsOrgan } from "./lungs-organ";
import { HeartOrgan } from "./heart-organ";
import { LiverOrgan } from "./liver-organ";
import { KidneysOrgan } from "./kidneys-organ";
import { GutOrgan } from "./gut-organ";
import { MetabolicOrgan } from "./metabolic-organ";
import { ImmuneOrgan } from "./immune-organ";
import { MusculoskeletalOrgan } from "./musculoskeletal-organ";

export type { OrganEmphasis, OrganProps } from "./types";
export { organOpacity } from "./types";

// "cardiovascular" renders the heart glyph — kept as a separate mapping key
// (rather than a HeartOrgan/CardiovascularOrgan naming mismatch) since the
// body system id is the stable, canonical identifier used everywhere else.
export const ORGAN_COMPONENTS: Record<BodySystemId, (props: OrganProps) => React.ReactNode> = {
  brain: BrainOrgan,
  lungs: LungsOrgan,
  cardiovascular: HeartOrgan,
  liver: LiverOrgan,
  kidneys: KidneysOrgan,
  gut: GutOrgan,
  metabolic: MetabolicOrgan,
  immune: ImmuneOrgan,
  musculoskeletal: MusculoskeletalOrgan,
};
