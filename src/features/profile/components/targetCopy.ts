import { Beef, Drumstick, Droplet, Leaf, Scale, SlidersHorizontal } from "lucide-react";
import type { ActivityLevel, DietPreset, GoalPace } from "@/lib/types";

export const activityMeta: Record<ActivityLevel, { label: string; short: string }> = {
  sedentary: { label: "Mostly seated", short: "Mostly seated" },
  light: { label: "Light · 1–2 workouts/week", short: "Light" },
  moderate: { label: "Moderate · 2–4 workouts/week", short: "Moderate" },
  active: { label: "Active · 5–6 workouts/week", short: "Active" },
  "very-active": { label: "Very active · physical work/training", short: "Very active" },
};

export const dietMeta: Record<DietPreset, { label: string; description: string }> = {
  balanced: { label: "Balanced", description: "Flexible everyday split" },
  "high-protein": { label: "High protein", description: "More protein, flexible carbs" },
  keto: { label: "Keto", description: "25 g carbs, higher fat" },
  "high-protein-keto": { label: "Protein keto", description: "30 g carbs, more protein" },
  "low-fat": { label: "Low fat", description: "20% calories from fat" },
  custom: { label: "Custom", description: "Set your own daily split" },
};

export const presetIcons = { balanced: Scale, "high-protein": Drumstick, keto: Droplet, "high-protein-keto": Beef, "low-fat": Leaf, custom: SlidersHorizontal } as const;

export const paceMeta: Record<GoalPace, { label: string; percentLose: string; percentGain: string }> = {
  conservative: { label: "Conservative", percentLose: "0.25% of bodyweight", percentGain: "0.125% of bodyweight" },
  moderate: { label: "Moderate", percentLose: "0.5% of bodyweight", percentGain: "0.25% of bodyweight" },
  aggressive: { label: "Aggressive", percentLose: "0.75% of bodyweight", percentGain: "0.375% of bodyweight" },
};
