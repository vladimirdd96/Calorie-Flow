"use client";

import { Check, ChevronRight } from "lucide-react";
import { NumericInput } from "@/features/shared/NumericInput";
import { calculateMacroTargets, macroPresetRuleFields, type MacroTargets } from "@/lib/nutrition";
import type { DietPreset, MacroPresetOverride, Profile } from "@/lib/types";
import { dietMeta, presetIcons } from "./targetCopy";

const macroOverrideFieldMeta: Record<keyof MacroPresetOverride, { label: string; unit: string; toDisplay: (value: number) => number; fromDisplay: (value: number) => number }> = {
  proteinPerKg: { label: "Protein", unit: "g/kg", toDisplay: (value) => value, fromDisplay: (value) => value },
  fatPerKg: { label: "Fat", unit: "g/kg", toDisplay: (value) => value, fromDisplay: (value) => value },
  carbCap: { label: "Carb cap", unit: "g", toDisplay: (value) => value, fromDisplay: (value) => value },
  fatPercent: { label: "Fat share", unit: "% of calories", toDisplay: (value) => Math.round(value * 100), fromDisplay: (value) => value / 100 },
};

function MacroPresetTuner({ profile, onPatch }: { profile: Profile; onPatch: (patch: Partial<Profile>) => void }) {
  if (profile.dietPreset === "custom") return null;
  const fields = macroPresetRuleFields[profile.dietPreset];
  const current = profile.macroPresetOverrides?.[profile.dietPreset] || {};
  return (
    <details className="nutrition-goals-advanced">
      <summary>
        <span><strong>Fine-tune macro ratios</strong><small>Adjust how {dietMeta[profile.dietPreset].label.toLowerCase()} calculates protein, fat and carbs</small></span>
        <ChevronRight size={16} aria-hidden="true" />
      </summary>
      <div className="nutrition-goal-fields">
        {fields.map((field) => {
          const meta = macroOverrideFieldMeta[field];
          return (
            <label key={field}>
              <span>{meta.label}</span>
              <div className="input-suffix">
                <NumericInput
                  min="0"
                  inputMode="decimal"
                  value={current[field] !== undefined ? meta.toDisplay(current[field]!) : ""}
                  placeholder="Default"
                  onChange={(event) => {
                    const raw = event.target.value;
                    const next = { ...current };
                    if (raw.trim() === "") delete next[field];
                    else next[field] = meta.fromDisplay(Math.max(0, Number(raw)));
                    onPatch({ macroPresetOverrides: { ...profile.macroPresetOverrides, [profile.dietPreset]: next } });
                  }}
                />
                <span>{meta.unit}</span>
              </div>
            </label>
          );
        })}
      </div>
    </details>
  );
}

export function NutritionStylePicker({ profile, calories, macros, onPatch, showTuner = false }: {
  profile: Profile;
  calories: number;
  macros: MacroTargets;
  onPatch: (patch: Partial<Profile>) => void;
  showTuner?: boolean;
}) {
  const macrosFor = (preset: DietPreset): MacroTargets => {
    if (preset === "custom") return { protein: profile.proteinTarget, carbs: profile.carbsTarget, fat: profile.fatTarget, shortfallKcal: 0 };
    if (preset === profile.dietPreset) return macros;
    return calculateMacroTargets({ calories, weightKg: profile.weightKg, heightCm: profile.heightCm, goalMode: profile.goalMode, goalWeightKg: profile.goalWeightKg, preset, overrides: profile.macroPresetOverrides });
  };

  /** Seeding the manual fields on the way into Custom keeps the switch from blanking the user's split. */
  const selectPreset = (preset: DietPreset) => {
    if (preset === "custom") onPatch({ dietPreset: preset, proteinTarget: macros.protein, carbsTarget: macros.carbs, fatTarget: macros.fat });
    else onPatch({ dietPreset: preset });
  };

  return (
    <>
      <div className="onboarding-preset-grid" role="group" aria-label="Nutrition style">
        {(Object.keys(dietMeta) as DietPreset[]).map((preset) => {
          const Icon = presetIcons[preset];
          const presetMacros = macrosFor(preset);
          return (
            <button key={preset} type="button" className={profile.dietPreset === preset ? "active" : ""} aria-pressed={profile.dietPreset === preset} onClick={() => selectPreset(preset)}>
              <Icon size={16} aria-hidden="true" />
              <span>
                <strong>{dietMeta[preset].label}</strong>
                <small>{dietMeta[preset].description}</small>
                <em>P {presetMacros.protein} · C {presetMacros.carbs} · F {presetMacros.fat} g</em>
              </span>
              {profile.dietPreset === preset && <Check size={14} className="preset-check" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      {profile.dietPreset === "custom" && (
        <div className="onboarding-macro-edit">
          {([["proteinTarget", "Protein"], ["carbsTarget", "Carbs"], ["fatTarget", "Fat"]] as const).map(([key, label]) => (
            <label key={key}>
              <span>{label} g</span>
              <NumericInput required min="0" inputMode="decimal" value={profile[key]} onChange={(event) => onPatch({ [key]: Math.max(0, Number(event.target.value)) })} />
            </label>
          ))}
        </div>
      )}

      {showTuner && <MacroPresetTuner profile={profile} onPatch={onPatch} />}
    </>
  );
}
