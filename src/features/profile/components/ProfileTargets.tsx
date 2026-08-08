"use client";

import { ChevronRight } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { NumericInput } from "@/features/shared/NumericInput";
import { ThemedSelect } from "@/features/shared/ThemedSelect";
import { effectiveCalorieTarget } from "@/lib/energy";
import { calculateMacroTargets, type MacroTargets } from "@/lib/nutrition";
import { cmToIn, inToCm, isImperial, kgToLb, lbToKg, weightUnitFor } from "@/lib/units";
import { currentTargetModelVersion, type ActivityLevel, type GoalMode, type Profile, type Sex } from "@/lib/types";
import { CalorieTargetPanel, CustomCalorieOverride } from "./CalorieTargetPanel";
import { GoalPacePicker } from "./GoalPacePicker";
import { MaintenanceSourceField } from "./MaintenanceSourceField";
import { NutritionGoalFields } from "./NutritionGoalFields";
import { NutritionStylePicker } from "./NutritionStylePicker";
import { activityMeta } from "./targetCopy";

const onboardingTitles = ["About you", "Activity & goal", "Nutrition style"] as const;
const goalModes: GoalMode[] = ["lose", "maintain", "gain"];
const goalLabels: Record<GoalMode, string> = { lose: "Lose", maintain: "Maintain", gain: "Gain" };

const activityOptions = (Object.keys(activityMeta) as ActivityLevel[]).map((value) => ({ value, label: activityMeta[value].label }));

function GoalModeField({ profile, onPatch }: { profile: Profile; onPatch: (patch: Partial<Profile>) => void }) {
  return (
    <div className="field-block">
      <span id="goal-label">Goal</span>
      <div className="segmented three" role="group" aria-labelledby="goal-label">
        {goalModes.map((mode) => (
          <button key={mode} type="button" aria-pressed={profile.goalMode === mode} className={profile.goalMode === mode ? "active" : ""} onClick={() => onPatch({ goalMode: mode })}>
            {goalLabels[mode]}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The one editor behind both onboarding and Profile → Edit targets. Keeping them the same component
 * is what stops goal and pace from being decidable exactly once and then unreachable forever.
 */
export function TargetEditor({ profile, onSave, onCancel, onboarding = false }: { profile: Profile; onSave: (profile: Profile) => void; onCancel?: () => void; onboarding?: boolean }) {
  const [draft, setDraft] = useState(profile);
  const imperial = isImperial(profile.measurementSystem);
  const [heightInput, setHeightInput] = useState(String(imperial ? Math.round(cmToIn(profile.heightCm) * 10) / 10 : profile.heightCm));
  const [weightInput, setWeightInput] = useState(String(imperial ? Math.round(kgToLb(profile.weightKg) * 10) / 10 : profile.weightKg));
  const [step, setStep] = useState(0);
  const onboardingFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!onboarding) return;
    onboardingFormRef.current?.closest(".onboarding-overlay")?.scrollTo({ top: 0 });
  }, [onboarding, step]);

  const patch = (next: Partial<Profile>) => setDraft((current) => ({ ...current, ...next }));

  const calories = effectiveCalorieTarget(draft);
  const macros: MacroTargets = draft.dietPreset === "custom"
    ? { protein: draft.proteinTarget, carbs: draft.carbsTarget, fat: draft.fatTarget, shortfallKcal: 0 }
    : calculateMacroTargets({ calories, weightKg: draft.weightKg, heightCm: draft.heightCm, goalMode: draft.goalMode, goalWeightKg: draft.goalWeightKg, preset: draft.dietPreset, overrides: draft.macroPresetOverrides });

  const updateMeasurement = (kind: "height" | "weight", value: string) => {
    if (kind === "height") setHeightInput(value);
    else setWeightInput(value);
    if (value.trim() === "") return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    if (kind === "height") patch({ heightCm: imperial ? inToCm(parsed) : parsed });
    else patch({ weightKg: imperial ? lbToKg(parsed) : parsed });
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave({
      ...draft,
      calorieTarget: calories,
      proteinTarget: macros.protein,
      carbsTarget: macros.carbs,
      fatTarget: macros.fat,
      targetModelVersion: currentTargetModelVersion,
      onboardingDone: true,
    });
  };

  const bodyFields = (
    <div className="form-grid two onboarding-basics">
      <label><span>Sex</span><ThemedSelect ariaLabel="Sex" value={draft.sex} onChange={(value) => patch({ sex: value as Sex })} options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }]} /></label>
      <label><span>Age</span><NumericInput required inputMode="numeric" min="16" max="100" value={draft.age} onChange={(event) => patch({ age: Number(event.target.value) })} /></label>
      <label><span>Height ({imperial ? "in" : "cm"})</span><NumericInput required inputMode="decimal" min={imperial ? 47 : 120} max={imperial ? 91 : 230} value={heightInput} onChange={(event) => updateMeasurement("height", event.target.value)} /></label>
      <label><span>Weight ({weightUnitFor(profile.measurementSystem)})</span><NumericInput required inputMode="decimal" min={imperial ? 77 : 35} max={imperial ? 661 : 300} step="0.1" value={weightInput} onChange={(event) => updateMeasurement("weight", event.target.value)} /></label>
    </div>
  );

  const moreGoals = (
    <details className="nutrition-goals-advanced">
      <summary>
        <span><strong>More nutrition goals</strong><small>Optional guides for sugar, saturated fat, sodium and potassium.</small></span>
        <ChevronRight size={16} aria-hidden="true" />
      </summary>
      <NutritionGoalFields profile={draft} onChange={(key, value) => patch({ [key]: value })} />
    </details>
  );

  if (onboarding) return (
    <form ref={onboardingFormRef} className="onboarding-form" onSubmit={save}>
      <header className="onboarding-intro">
        <span className="onboarding-mark" aria-hidden="true">CF</span>
        <span className="eyebrow">60-second setup</span>
        <h1>{onboardingTitles[step]}</h1>
      </header>
      <div className="onboarding-progress" aria-label={`Step ${step + 1} of 3`}>{[0, 1, 2].map((index) => <i key={index} className={index <= step ? "active" : ""} />)}</div>
      <section className="onboarding-step-card">
        {step === 0 && <>
          <p>The basics, used to estimate your baseline energy needs.</p>
          {bodyFields}
        </>}
        {step === 1 && <>
          <p>How active you are, and what you&apos;re working toward.</p>
          <label className="onboarding-activity"><span>Daily movement</span><ThemedSelect ariaLabel="Daily movement" value={draft.activity} onChange={(value) => patch({ activity: value as ActivityLevel })} options={activityOptions} /></label>
          <GoalModeField profile={draft} onPatch={patch} />
          <GoalPacePicker profile={draft} onUpdate={(key, value) => patch({ [key]: value })} />
          <MaintenanceSourceField profile={draft} onPatch={patch} />
        </>}
        {step === 2 && <>
          <div className="onboarding-style-heading"><span>Nutrition style</span><small>optional</small></div>
          <NutritionStylePicker profile={draft} calories={calories} macros={macros} onPatch={patch} />
          <CalorieTargetPanel profile={draft} macros={macros} variant="onboarding" onPatch={patch} />
          <CustomCalorieOverride profile={draft} onPatch={patch} />
          {moreGoals}
        </>}
      </section>
      <footer className="onboarding-actions">
        {step > 0 && <button className="secondary-button" type="button" onClick={() => setStep((current) => Math.max(0, current - 1))}>Back</button>}
        {step < 2
          ? <button className="primary-button" type="button" onClick={() => setStep((current) => Math.min(2, current + 1))}>Next<ChevronRight size={17} /></button>
          : <button className="primary-button" type="submit">Start tracking<ChevronRight size={17} /></button>}
      </footer>
      {step === 2 && <p className="onboarding-footnote">Calculated with Mifflin–St Jeor. Treat the result as a starting estimate and adjust from your weight trend.</p>}
    </form>
  );

  return (
    <form className="profile-compact-sheet" onSubmit={save}>
      <CalorieTargetPanel profile={draft} macros={macros} variant="sheet" storedTarget={profile.calorieTarget} onPatch={patch} />
      <div>
        <GoalModeField profile={draft} onPatch={patch} />
        <GoalPacePicker profile={draft} onUpdate={(key, value) => patch({ [key]: value })} />
      </div>
      <MaintenanceSourceField profile={draft} onPatch={patch} />
      <div>
        <span className="sheet-section-label">Nutrition style</span>
        <NutritionStylePicker profile={draft} calories={calories} macros={macros} onPatch={patch} showTuner />
      </div>
      <CustomCalorieOverride profile={draft} onPatch={patch} />
      {moreGoals}
      <div className="target-editor-actions">
        {onCancel && <button className="secondary-button" type="button" onClick={onCancel}>Cancel</button>}
        <button className="primary-button full" type="submit">Save targets</button>
      </div>
      <p className="form-footnote">Calculated with Mifflin–St Jeor. Treat the result as a starting estimate and adjust from your weight trend.</p>
    </form>
  );
}
