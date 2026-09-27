import { Brain, HeartPulse, Wind, Sprout, Droplets, Flame, Dumbbell, ShieldCheck, type LucideIcon } from "lucide-react";
import { BodySystemId } from "@/types/health";

export const SYSTEM_ICONS: Record<BodySystemId, LucideIcon> = {
  brain: Brain,
  cardiovascular: HeartPulse,
  lungs: Wind,
  liver: Flame,
  gut: Sprout,
  kidneys: Droplets,
  metabolic: Flame,
  musculoskeletal: Dumbbell,
  immune: ShieldCheck,
};
