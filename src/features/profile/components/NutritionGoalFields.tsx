"use client";

import { NumericInput } from "@/features/shared/NumericInput";
import type { NutritionTargetKey, Profile } from "@/lib/types";

const nutritionGoals: Array<{ key: NutritionTargetKey; label: string; unit: string; detail: string }> = [
  { key: "sugarTarget", label: "Sugar", unit: "g", detail: "General daily guide" },
  { key: "saturatedFatTarget", label: "Saturated fat", unit: "g", detail: "Daily upper guide" },
  { key: "sodiumTarget", label: "Sodium", unit: "mg", detail: "Daily upper guide" },
  { key: "potassiumTarget", label: "Potassium", unit: "mg", detail: "Daily goal" },
];

export function NutritionGoalFields({ profile, onChange }: { profile: Profile; onChange: (key: NutritionTargetKey, value: number) => void }) {
  return <div className="nutrition-goal-fields">{nutritionGoals.map(({ key, label, unit, detail }) => <label key={key}><span>{label} <small>{detail}</small></span><div className="input-suffix"><NumericInput required min="0" inputMode="decimal" value={profile[key]} onChange={(event) => onChange(key, Math.max(0, Number(event.target.value)))} /><span>{unit}</span></div></label>)}</div>;
}
