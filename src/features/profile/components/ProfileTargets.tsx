"use client";

import { Beef, Check, ChevronRight, Drumstick, Droplet, Flame, Leaf, Pencil, Scale, SlidersHorizontal, Wheat } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { ThemedSelect } from "@/features/shared/ThemedSelect";
import { NumericInput } from "@/features/shared/NumericInput";
import { calculateCalories, calculateMacroTargets } from "@/lib/nutrition";
import type { ActivityLevel, DietPreset, GoalMode, Profile, Sex } from "@/lib/types";
import { measurementSystems } from "@/lib/types";
import { NutritionGoalFields } from "./NutritionGoalFields";

const kgToLb = (kg: number) => kg * 2.2046226218; const lbToKg = (lb: number) => lb / 2.2046226218; const cmToIn = (cm: number) => cm / 2.54; const inToCm = (inches: number) => inches * 2.54;
const measurementSystemFor = (profile: Profile) => profile.measurementSystem || measurementSystems.metric;
const weightUnitFor = (profile: Profile) => measurementSystemFor(profile) === measurementSystems.imperial ? "lb" : "kg";
const dietMeta: Record<DietPreset, { label: string; description: string }> = { balanced: { label: "Balanced", description: "Flexible everyday split" }, "high-protein": { label: "High protein", description: "More protein, flexible carbs" }, keto: { label: "Keto", description: "25 g carbs, higher fat" }, "high-protein-keto": { label: "Protein keto", description: "30 g carbs, more protein" }, "low-fat": { label: "Low fat", description: "20% calories from fat" }, custom: { label: "Custom", description: "Set your own daily split" } };
const presetIcons = { balanced: Scale, "high-protein": Drumstick, keto: Droplet, "high-protein-keto": Beef, "low-fat": Leaf, custom: SlidersHorizontal } as const;
const onboardingTitles = ["About you", "Activity & goal", "Nutrition style"] as const;

export function TargetEditor({ profile, onSave, onCancel, onboarding = false }: { profile: Profile; onSave: (profile: Profile) => void; onCancel?: () => void; onboarding?: boolean }) {
  const [draft, setDraft] = useState(profile);
  const measurementSystem = measurementSystemFor(profile);
  const [heightInput, setHeightInput] = useState(String(measurementSystem === measurementSystems.imperial ? Math.round(cmToIn(profile.heightCm) * 10) / 10 : profile.heightCm));
  const [weightInput, setWeightInput] = useState(String(measurementSystem === measurementSystems.imperial ? Math.round(kgToLb(profile.weightKg) * 10) / 10 : profile.weightKg));
  const [editingPreset, setEditingPreset] = useState<DietPreset | null>(profile.dietPreset === "custom" ? "custom" : null);
  const [step, setStep] = useState(0);
  const onboardingFormRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!onboarding) return;
    onboardingFormRef.current?.closest(".onboarding-overlay")?.scrollTo({ top: 0 });
  }, [onboarding, step]);
  const calculatedCalories = calculateCalories(draft);
  const calculatedMacros = draft.dietPreset === "custom"
    ? { protein: draft.proteinTarget, carbs: draft.carbsTarget, fat: draft.fatTarget }
    : calculateMacroTargets(calculatedCalories, draft.weightKg, draft.dietPreset);
  const update = <K extends keyof Profile>(key: K, value: Profile[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const selectPreset = (preset: DietPreset) => {
    const macros = preset === "custom" ? { protein: draft.proteinTarget, carbs: draft.carbsTarget, fat: draft.fatTarget } : calculateMacroTargets(calculatedCalories, draft.weightKg, preset);
    setDraft((current) => ({ ...current, dietPreset: preset, proteinTarget: macros.protein, carbsTarget: macros.carbs, fatTarget: macros.fat }));
    setEditingPreset(preset === "custom" ? "custom" : null);
  };
  const editPreset = (preset: DietPreset) => {
    selectPreset(preset);
    setEditingPreset(preset);
  };
  const updateMacro = (key: "proteinTarget" | "carbsTarget" | "fatTarget", value: string) => update(key, Math.max(0, Number(value)));
  const updateMeasurement = (kind: "height" | "weight", value: string) => {
    if (kind === "height") setHeightInput(value);
    else setWeightInput(value);
    if (value.trim() === "") return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    update(kind === "height" ? "heightCm" : "weightKg", kind === "height" && measurementSystem === measurementSystems.imperial ? inToCm(parsed) : kind === "weight" && measurementSystem === measurementSystems.imperial ? lbToKg(parsed) : parsed);
  };
  const savedMacros = editingPreset ? { protein: draft.proteinTarget, carbs: draft.carbsTarget, fat: draft.fatTarget } : calculatedMacros;
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave({
    ...draft,
    calorieTarget: calculatedCalories,
    proteinTarget: savedMacros.protein,
    carbsTarget: savedMacros.carbs,
    fatTarget: savedMacros.fat,
    onboardingDone: true,
    });
  };
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
          <div className="form-grid two onboarding-basics">
            <label><span>Sex</span><ThemedSelect ariaLabel="Sex" value={draft.sex} onChange={(value) => update("sex", value as Sex)} options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }]} /></label>
            <label><span>Age</span><NumericInput required inputMode="numeric" min="16" max="100" value={draft.age} onChange={(event) => update("age", Number(event.target.value))} /></label>
            <label><span>Height ({measurementSystem === measurementSystems.imperial ? "in" : "cm"})</span><NumericInput required inputMode="decimal" min={measurementSystem === measurementSystems.imperial ? 47 : 120} max={measurementSystem === measurementSystems.imperial ? 91 : 230} value={heightInput} onChange={(event) => updateMeasurement("height", event.target.value)} /></label>
            <label><span>Weight ({weightUnitFor(profile)})</span><NumericInput required inputMode="decimal" min={measurementSystem === measurementSystems.imperial ? 77 : 35} max={measurementSystem === measurementSystems.imperial ? 661 : 300} step="0.1" value={weightInput} onChange={(event) => updateMeasurement("weight", event.target.value)} /></label>
          </div>
        </>}
        {step === 1 && <>
          <p>How active you are, and what you&apos;re working toward.</p>
          <label className="onboarding-activity"><span>Daily movement</span><ThemedSelect ariaLabel="Daily movement" value={draft.activity} onChange={(value) => update("activity", value as ActivityLevel)} options={[{ value: "sedentary", label: "Mostly seated" }, { value: "light", label: "Light · 1–2 workouts/week" }, { value: "moderate", label: "Moderate · 2–4 workouts/week" }, { value: "active", label: "Active · 5–6 workouts/week" }, { value: "very-active", label: "Very active · physical work/training" }]} /></label>
          <div className="field-block"><span id="onboarding-goal-label">Goal</span><div className="segmented three" role="group" aria-labelledby="onboarding-goal-label"><button type="button" aria-pressed={draft.goalMode === "lose"} className={draft.goalMode === "lose" ? "active" : ""} onClick={() => update("goalMode", "lose" as GoalMode)}>Lose</button><button type="button" aria-pressed={draft.goalMode === "maintain"} className={draft.goalMode === "maintain" ? "active" : ""} onClick={() => update("goalMode", "maintain" as GoalMode)}>Maintain</button><button type="button" aria-pressed={draft.goalMode === "gain"} className={draft.goalMode === "gain" ? "active" : ""} onClick={() => update("goalMode", "gain" as GoalMode)}>Gain</button></div></div>
        </>}
        {step === 2 && <>
          <div className="onboarding-style-heading"><span>Nutrition style</span><small>optional</small></div>
          <div className="onboarding-preset-grid" role="group" aria-label="Nutrition style">{(Object.keys(dietMeta) as DietPreset[]).map((preset) => {
            const Icon = presetIcons[preset];
            const macros = editingPreset === preset ? { protein: draft.proteinTarget, carbs: draft.carbsTarget, fat: draft.fatTarget } : preset === draft.dietPreset ? calculatedMacros : preset === "custom" ? { protein: draft.proteinTarget, carbs: draft.carbsTarget, fat: draft.fatTarget } : calculateMacroTargets(calculatedCalories, draft.weightKg, preset);
            return <button key={preset} type="button" className={draft.dietPreset === preset ? "active" : ""} aria-pressed={draft.dietPreset === preset} onClick={() => selectPreset(preset)}><Icon size={16} /><span><strong>{dietMeta[preset].label}</strong><small>{dietMeta[preset].description}</small><em>P {macros.protein} · C {macros.carbs} · F {macros.fat} g</em></span>{draft.dietPreset === preset && <Check size={14} className="preset-check" />}</button>;
          })}</div>
          <div className="onboarding-target">
            <div className="onboarding-target-heading"><span><Flame size={17} /></span><div><small>Starting target</small><strong>{calculatedCalories.toLocaleString()} <em>kcal</em></strong></div></div>
            {editingPreset ? <div className="onboarding-macro-edit">{(["proteinTarget", "carbsTarget", "fatTarget"] as const).map((key) => <label key={key}><span>{key === "proteinTarget" ? "Protein" : key === "carbsTarget" ? "Carbs" : "Fat"} g</span><NumericInput required min="0" inputMode="decimal" value={draft[key]} onChange={(event) => updateMacro(key, event.target.value)} /></label>)}</div> : <div className="onboarding-macros"><span><Drumstick />P <strong>{calculatedMacros.protein} g</strong></span><span><Wheat />C <strong>{calculatedMacros.carbs} g</strong></span><span><Droplet />F <strong>{calculatedMacros.fat} g</strong></span></div>}
          </div>
          <details className="nutrition-goals-advanced">
            <summary><span><strong>More nutrition goals</strong><small>Optional guides for sugar, saturated fat, sodium and potassium.</small></span><ChevronRight size={16} /></summary>
            <NutritionGoalFields profile={draft} onChange={(key, value) => update(key, value)} />
          </details>
        </>}
      </section>
      <footer className="onboarding-actions">
        {step > 0 && <button className="secondary-button" type="button" onClick={() => setStep((current) => Math.max(0, current - 1))}>Back</button>}
        {step < 2 ? <button className="primary-button" type="button" onClick={() => setStep((current) => Math.min(2, current + 1))}>Next<ChevronRight size={17} /></button> : <button className="primary-button" type="submit">Start tracking<ChevronRight size={17} /></button>}
      </footer>
      {step === 2 && <p className="onboarding-footnote">Calculated with Mifflin–St Jeor. Treat the result as a starting estimate and adjust from your weight trend.</p>}
    </form>
  );
  return (
    <form className="profile-form" onSubmit={save}>
      <div className="form-grid two">
        <label><span>Sex</span><ThemedSelect ariaLabel="Sex" value={draft.sex} onChange={(value) => update("sex", value as Sex)} options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }]} /></label>
        <label><span>Age</span><NumericInput required inputMode="numeric" min="16" max="100" value={draft.age} onChange={(event) => update("age", Number(event.target.value))} /></label>
        <label><span>Height</span><div className="input-suffix"><NumericInput required inputMode="decimal" min={measurementSystem === measurementSystems.imperial ? 47 : 120} max={measurementSystem === measurementSystems.imperial ? 91 : 230} value={heightInput} onChange={(event) => updateMeasurement("height", event.target.value)} /><span>{measurementSystem === measurementSystems.imperial ? "in" : "cm"}</span></div></label>
        <label><span>Weight</span><div className="input-suffix"><NumericInput required inputMode="decimal" min={measurementSystem === measurementSystems.imperial ? 77 : 35} max={measurementSystem === measurementSystems.imperial ? 661 : 300} step="0.1" value={weightInput} onChange={(event) => updateMeasurement("weight", event.target.value)} /><span>{weightUnitFor(profile)}</span></div></label>
      </div>
      <label><span>Daily movement</span><ThemedSelect ariaLabel="Daily movement" value={draft.activity} onChange={(value) => update("activity", value as ActivityLevel)} options={[{ value: "sedentary", label: "Mostly seated" }, { value: "light", label: "Light · 1–2 workouts/week" }, { value: "moderate", label: "Moderate · 2–4 workouts/week" }, { value: "active", label: "Active · 5–6 workouts/week" }, { value: "very-active", label: "Very active · physical work/training" }]} /></label>
      <div className="field-block"><span id="goal-label">Goal</span><div className="segmented three" role="group" aria-labelledby="goal-label"><button type="button" aria-pressed={draft.goalMode === "lose"} className={draft.goalMode === "lose" ? "active" : ""} onClick={() => update("goalMode", "lose" as GoalMode)}>Lose</button><button type="button" aria-pressed={draft.goalMode === "maintain"} className={draft.goalMode === "maintain" ? "active" : ""} onClick={() => update("goalMode", "maintain" as GoalMode)}>Maintain</button><button type="button" aria-pressed={draft.goalMode === "gain"} className={draft.goalMode === "gain" ? "active" : ""} onClick={() => update("goalMode", "gain" as GoalMode)}>Gain</button></div></div>
      <div className="field-block"><span id="nutrition-style-label">Nutrition style <small>optional</small></span><div className="preset-grid" role="group" aria-labelledby="nutrition-style-label">{(Object.keys(dietMeta) as DietPreset[]).map((preset) => {
        const macros = editingPreset === preset ? { protein: draft.proteinTarget, carbs: draft.carbsTarget, fat: draft.fatTarget } : preset === draft.dietPreset ? calculatedMacros : preset === "custom" ? { protein: draft.proteinTarget, carbs: draft.carbsTarget, fat: draft.fatTarget } : calculateMacroTargets(calculatedCalories, draft.weightKg, preset);
        return <div className={`preset-option${draft.dietPreset === preset ? " active" : ""}`} key={preset}><button type="button" aria-pressed={draft.dietPreset === preset} className="preset-select" onClick={() => selectPreset(preset)}><strong>{dietMeta[preset].label}</strong><small>{dietMeta[preset].description}</small><span className="preset-macros">P {macros.protein} · C {macros.carbs} · F {macros.fat} g</span>{draft.dietPreset === preset && <Check size={17} />}</button>{preset !== "custom" && <button type="button" className="preset-edit" aria-label={`Edit ${dietMeta[preset].label} nutrition`} onClick={() => editPreset(preset)}><Pencil size={14} /></button>}</div>;
      })}</div></div>
      <div className="calculated-target card">
        {!draft.hideCalories && <div><span>Starting target</span><strong>{calculatedCalories.toLocaleString()} <small>kcal</small></strong></div>}
        {editingPreset ? <div className="macro-edit-grid"><label><span>Protein</span><div className="input-suffix"><NumericInput required min="0" inputMode="decimal" value={draft.proteinTarget} onChange={(event) => updateMacro("proteinTarget", event.target.value)} /><span>g</span></div></label><label><span>Carbs</span><div className="input-suffix"><NumericInput required min="0" inputMode="decimal" value={draft.carbsTarget} onChange={(event) => updateMacro("carbsTarget", event.target.value)} /><span>g</span></div></label><label><span>Fat</span><div className="input-suffix"><NumericInput required min="0" inputMode="decimal" value={draft.fatTarget} onChange={(event) => updateMacro("fatTarget", event.target.value)} /><span>g</span></div></label></div> : <div className="target-macros"><span>P <strong>{calculatedMacros.protein} g</strong></span><span>C <strong>{calculatedMacros.carbs} g</strong></span><span>F <strong>{calculatedMacros.fat} g</strong></span></div>}
      </div>
      <details className="nutrition-goals-advanced">
        <summary><span><strong>More nutrition goals</strong><small>Set daily guides for sugar, saturated fat, sodium and potassium.</small></span><ChevronRight size={16} /></summary>
        <NutritionGoalFields profile={draft} onChange={(key, value) => update(key, value)} />
      </details>
      <div className="target-editor-actions"><button className="secondary-button" type="button" onClick={onCancel}>Cancel</button><button className="primary-button" type="submit">Save adjustments<ChevronRight size={18} /></button></div>
      <p className="form-footnote">Calculated with Mifflin–St Jeor. Treat the result as a starting estimate and adjust from your weight trend.</p>
    </form>
  );
}

export function TargetSummary({ profile, expanded, onEdit }: { profile: Profile; expanded: boolean; onEdit: () => void }) {
  const goalLabel = profile.goalMode === "lose" ? "Fat loss" : profile.goalMode === "gain" ? "Muscle gain" : "Maintenance";
  return (
    <section className="targets-section" aria-label="Daily nutrition targets">
      <div className="section-heading target-summary-heading"><div><span className="eyebrow">Your baseline</span><h2>Daily targets</h2></div><button className="text-button" type="button" aria-expanded={expanded} aria-controls="target-editor" onClick={onEdit}><Pencil size={16} />Adjust</button></div>
      <div className="target-summary">
        {!profile.hideCalories && <div className="target-energy"><span>Daily energy</span><strong>{profile.calorieTarget.toLocaleString()} <small>kcal</small></strong><small>{goalLabel} · a starting point, not a rule</small></div>}
        <div className="target-macros"><span>Protein <strong>{profile.proteinTarget} g</strong></span><span>Carbs <strong>{profile.carbsTarget} g</strong></span><span>Fat <strong>{profile.fatTarget} g</strong></span></div>
      </div>
    </section>
  );
}
