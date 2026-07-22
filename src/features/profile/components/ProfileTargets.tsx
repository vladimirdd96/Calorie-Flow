"use client";

import { Check, ChevronRight, Pencil } from "lucide-react";
import { type FormEvent, useState } from "react";
import { ThemedSelect } from "@/features/shared/ThemedSelect";
import { calculateCalories, calculateMacroTargets } from "@/lib/nutrition";
import type { ActivityLevel, DietPreset, GoalMode, Profile, Sex } from "@/lib/types";
import { measurementSystems } from "@/lib/types";

function BrandMark({ large = false }: { large?: boolean }) { return <img className={`brand-mark${large ? " large" : ""}`} src="/icon.svg" alt="" aria-hidden="true" />; }
const kgToLb = (kg: number) => kg * 2.2046226218; const lbToKg = (lb: number) => lb / 2.2046226218; const cmToIn = (cm: number) => cm / 2.54; const inToCm = (inches: number) => inches * 2.54;
const measurementSystemFor = (profile: Profile) => profile.measurementSystem || measurementSystems.metric;
const weightUnitFor = (profile: Profile) => measurementSystemFor(profile) === measurementSystems.imperial ? "lb" : "kg";
const dietMeta: Record<DietPreset, { label: string; description: string }> = { balanced: { label: "Balanced", description: "Flexible everyday split" }, "high-protein": { label: "High protein", description: "More protein, flexible carbs" }, keto: { label: "Keto", description: "25 g carbs, higher fat" }, "high-protein-keto": { label: "Protein keto", description: "30 g carbs, more protein" }, "low-fat": { label: "Low fat", description: "20% calories from fat" }, custom: { label: "Custom", description: "Set your own daily split" } };

export function TargetEditor({ profile, onSave, onCancel, onboarding = false }: { profile: Profile; onSave: (profile: Profile) => void; onCancel?: () => void; onboarding?: boolean }) {
  const [draft, setDraft] = useState(profile);
  const measurementSystem = measurementSystemFor(profile);
  const [heightInput, setHeightInput] = useState(String(measurementSystem === measurementSystems.imperial ? Math.round(cmToIn(profile.heightCm) * 10) / 10 : profile.heightCm));
  const [weightInput, setWeightInput] = useState(String(measurementSystem === measurementSystems.imperial ? Math.round(kgToLb(profile.weightKg) * 10) / 10 : profile.weightKg));
  const [editingPreset, setEditingPreset] = useState<DietPreset | null>(profile.dietPreset === "custom" ? "custom" : null);
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
  return (
    <form className={onboarding ? "onboarding-form" : "profile-form"} onSubmit={save}>
      {onboarding && <div className="onboarding-intro"><BrandMark large /><span className="eyebrow">60-second setup</span><h1>Your targets, without the quiz marathon.</h1><p>These are a sensible starting point. You can edit them any time.</p></div>}
      <div className="form-grid two">
        <label><span>Sex</span><ThemedSelect ariaLabel="Sex" value={draft.sex} onChange={(value) => update("sex", value as Sex)} options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }]} /></label>
        <label><span>Age</span><input required type="number" inputMode="numeric" min="16" max="100" value={draft.age} onChange={(event) => update("age", Number(event.target.value))} /></label>
        <label><span>Height</span><div className="input-suffix"><input required type="number" inputMode="decimal" min={measurementSystem === measurementSystems.imperial ? 47 : 120} max={measurementSystem === measurementSystems.imperial ? 91 : 230} value={heightInput} onChange={(event) => updateMeasurement("height", event.target.value)} /><span>{measurementSystem === measurementSystems.imperial ? "in" : "cm"}</span></div></label>
        <label><span>Weight</span><div className="input-suffix"><input required type="number" inputMode="decimal" min={measurementSystem === measurementSystems.imperial ? 77 : 35} max={measurementSystem === measurementSystems.imperial ? 661 : 300} step="0.1" value={weightInput} onChange={(event) => updateMeasurement("weight", event.target.value)} /><span>{weightUnitFor(profile)}</span></div></label>
      </div>
      <label><span>Daily movement</span><ThemedSelect ariaLabel="Daily movement" value={draft.activity} onChange={(value) => update("activity", value as ActivityLevel)} options={[{ value: "sedentary", label: "Mostly seated" }, { value: "light", label: "Light · 1–2 workouts/week" }, { value: "moderate", label: "Moderate · 2–4 workouts/week" }, { value: "active", label: "Active · 5–6 workouts/week" }, { value: "very-active", label: "Very active · physical work/training" }]} /></label>
      <div className="field-block"><span id="goal-label">Goal</span><div className="segmented three" role="group" aria-labelledby="goal-label"><button type="button" aria-pressed={draft.goalMode === "lose"} className={draft.goalMode === "lose" ? "active" : ""} onClick={() => update("goalMode", "lose" as GoalMode)}>Lose</button><button type="button" aria-pressed={draft.goalMode === "maintain"} className={draft.goalMode === "maintain" ? "active" : ""} onClick={() => update("goalMode", "maintain" as GoalMode)}>Maintain</button><button type="button" aria-pressed={draft.goalMode === "gain"} className={draft.goalMode === "gain" ? "active" : ""} onClick={() => update("goalMode", "gain" as GoalMode)}>Gain</button></div></div>
      <div className="field-block"><span id="nutrition-style-label">Nutrition style <small>optional</small></span><div className="preset-grid" role="group" aria-labelledby="nutrition-style-label">{(Object.keys(dietMeta) as DietPreset[]).map((preset) => {
        const macros = editingPreset === preset ? { protein: draft.proteinTarget, carbs: draft.carbsTarget, fat: draft.fatTarget } : preset === draft.dietPreset ? calculatedMacros : preset === "custom" ? { protein: draft.proteinTarget, carbs: draft.carbsTarget, fat: draft.fatTarget } : calculateMacroTargets(calculatedCalories, draft.weightKg, preset);
        return <div className={`preset-option${draft.dietPreset === preset ? " active" : ""}`} key={preset}><button type="button" aria-pressed={draft.dietPreset === preset} className="preset-select" onClick={() => selectPreset(preset)}><strong>{dietMeta[preset].label}</strong><small>{dietMeta[preset].description}</small><span className="preset-macros">P {macros.protein} · C {macros.carbs} · F {macros.fat} g</span>{draft.dietPreset === preset && <Check size={17} />}</button>{preset !== "custom" && <button type="button" className="preset-edit" aria-label={`Edit ${dietMeta[preset].label} nutrition`} onClick={() => editPreset(preset)}><Pencil size={14} /></button>}</div>;
      })}</div></div>
      <div className="calculated-target card">
        {!draft.hideCalories && <div><span>Starting target</span><strong>{calculatedCalories.toLocaleString()} <small>kcal</small></strong></div>}
        {editingPreset ? <div className="macro-edit-grid"><label><span>Protein</span><div className="input-suffix"><input required min="0" type="number" inputMode="decimal" value={draft.proteinTarget} onChange={(event) => updateMacro("proteinTarget", event.target.value)} /><span>g</span></div></label><label><span>Carbs</span><div className="input-suffix"><input required min="0" type="number" inputMode="decimal" value={draft.carbsTarget} onChange={(event) => updateMacro("carbsTarget", event.target.value)} /><span>g</span></div></label><label><span>Fat</span><div className="input-suffix"><input required min="0" type="number" inputMode="decimal" value={draft.fatTarget} onChange={(event) => updateMacro("fatTarget", event.target.value)} /><span>g</span></div></label></div> : <div className="target-macros"><span>P <strong>{calculatedMacros.protein} g</strong></span><span>C <strong>{calculatedMacros.carbs} g</strong></span><span>F <strong>{calculatedMacros.fat} g</strong></span></div>}
      </div>
      {onboarding ? <button className="primary-button full" type="submit">Start tracking<ChevronRight size={18} /></button> : <div className="target-editor-actions"><button className="secondary-button" type="button" onClick={onCancel}>Cancel</button><button className="primary-button" type="submit">Save adjustments<ChevronRight size={18} /></button></div>}
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
