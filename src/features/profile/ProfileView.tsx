"use client";

import { BarChart3, Check, ChevronDown, ChevronRight, Download, Cloud, LogOut, Pencil, RotateCcw, Share2, ShieldCheck, Moon, Sun, Upload, Utensils, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ThemedSelect } from "@/features/shared/ThemedSelect";
import { Sheet } from "@/features/shared/Sheet";
import type { AppTab } from "@/features/app/types";
import { validateBackup } from "@/lib/db";
import { acceptCloudDiaryShare, getCloudDiaryShares, getSharedDiarySnapshot, inviteCloudDiaryShare, revokeCloudDiaryShare } from "@/lib/cloud";
import { calculateCalories, calculateMacroTargets, localDateKey, round } from "@/lib/nutrition";
import { isHabitFeatureEnabled, toggleHabitFeature } from "@/lib/habit-settings";
import { mealsCsv } from "@/lib/reports";
import { type CloudUser } from "@/lib/supabase";
import type { ActivityLevel, DietPreset, DiaryShare, GoalMode, Meal, MealType, Nutrition, Profile, Sex, HabitFeature, WeightTrackingStatus, Weekday } from "@/lib/types";
import { habitFeatures, measurementSystems, weightTrackingStatuses } from "@/lib/types";
import type { BackupData } from "@/lib/db";

type ProfileSection = "profile" | "customize";

type SyncState = "local" | "syncing" | "synced" | "offline" | "error";

const themeModes = { light: "light", dark: "dark" } as const;

type ThemeMode = typeof themeModes[keyof typeof themeModes];

const chatTextSizes = { compact: "compact", comfortable: "comfortable", large: "large" } as const;

type ChatTextSize = typeof chatTextSizes[keyof typeof chatTextSizes];

function BrandMark({ large = false }: { large?: boolean }) {
  return <img className={`brand-mark${large ? " large" : ""}`} src="/icon.svg" alt="" aria-hidden="true" />;
}

function useModalFocus(onClose?: () => void) {
  const surfaceRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const surface = surfaceRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    if (!surface) return;
    const focusable = () => [...surface.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter((element) => !element.hidden);
    window.requestAnimationFrame(() => (surface.querySelector<HTMLElement>("[autofocus]") || focusable()[0] || surface).focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && closeRef.current) {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) { event.preventDefault(); surface.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return surfaceRef;
}

function useDismissibleDisclosure<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const disclosureRef = useRef<T>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const dismissOnPointerDown = (event: PointerEvent) => {
      if (disclosureRef.current && !disclosureRef.current.contains(event.target as Node)) closeRef.current();
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    document.addEventListener("pointerdown", dismissOnPointerDown);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOnPointerDown);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [open]);
  return disclosureRef;
}

const kgToLb = (kg: number) => kg * 2.2046226218;

const lbToKg = (lb: number) => lb / 2.2046226218;

const cmToIn = (cm: number) => cm / 2.54;

const inToCm = (inches: number) => inches * 2.54;

const measurementSystemFor = (profile: Profile) => profile.measurementSystem || measurementSystems.metric;

const weightUnitFor = (profile: Profile) => measurementSystemFor(profile) === measurementSystems.imperial ? "lb" : "kg";

function providerAvatarUrl(user: CloudUser | null) {
  const candidate = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  return typeof candidate === "string" && candidate.trim() ? candidate : undefined;
}

function accountDisplayName(user: CloudUser | null) {
  const candidates = [user?.user_metadata?.full_name, user?.user_metadata?.name];
  return candidates.find((candidate): candidate is string => typeof candidate === "string" && Boolean(candidate.trim()))?.trim();
}

function resizeAvatar(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("The image could not be opened."));
      image.onload = () => {
        const size = 256;
        const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) return reject(new Error("The image could not be prepared."));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", .82));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

const mealLabels: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

const dietMeta: Record<DietPreset, { label: string; description: string }> = {
  balanced: { label: "Balanced", description: "Flexible everyday split" },
  "high-protein": { label: "High protein", description: "More protein, flexible carbs" },
  keto: { label: "Keto", description: "25 g carbs, higher fat" },
  "high-protein-keto": { label: "Protein keto", description: "30 g carbs, more protein" },
  "low-fat": { label: "Low fat", description: "20% calories from fat" },
  custom: { label: "Custom", description: "Set your own daily split" },
};

type Tab = AppTab;

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function TargetEditor({ profile, onSave, onCancel, onboarding = false }: { profile: Profile; onSave: (profile: Profile) => void; onCancel?: () => void; onboarding?: boolean }) {
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

function TargetSummary({ profile, expanded, onEdit }: { profile: Profile; expanded: boolean; onEdit: () => void }) {
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

function DisplayPreferences({ hideCalories, onChange, chatTextSize, onChatTextSizeChange }: { hideCalories: boolean; onChange: (hideCalories: boolean) => void; chatTextSize: ChatTextSize; onChatTextSizeChange: (size: ChatTextSize) => void }) {
  return (
    <section className="display-section">
      <div className="section-heading"><div><span className="eyebrow">App display</span><h2>Calorie visibility</h2></div></div>
      <button className={`display-preference ${hideCalories ? "active" : ""}`} type="button" aria-pressed={hideCalories} onClick={() => onChange(!hideCalories)}><span><strong>{hideCalories ? "Calories are hidden" : "Calories are visible"}</strong><small>{hideCalories ? "Your diary and insights focus on macros and nutrients." : "Hide calorie numbers throughout the app whenever you prefer."}</small></span><span className="toggle" /></button>
      <div className="display-subsection">
        <div className="display-subsection-heading"><span className="eyebrow">Coach</span><h3>Text size</h3></div>
        <p className="display-subsection-description">Change message density without shrinking buttons or inputs.</p>
        <div className="segmented three" role="group" aria-label="Coach text size">
          <button type="button" aria-pressed={chatTextSize === chatTextSizes.compact} className={`text-size-option compact${chatTextSize === chatTextSizes.compact ? " active" : ""}`} onClick={() => onChatTextSizeChange(chatTextSizes.compact)}>Compact</button>
          <button type="button" aria-pressed={chatTextSize === chatTextSizes.comfortable} className={`text-size-option comfortable${chatTextSize === chatTextSizes.comfortable ? " active" : ""}`} onClick={() => onChatTextSizeChange(chatTextSizes.comfortable)}>Comfortable</button>
          <button type="button" aria-pressed={chatTextSize === chatTextSizes.large} className={`text-size-option large${chatTextSize === chatTextSizes.large ? " active" : ""}`} onClick={() => onChatTextSizeChange(chatTextSizes.large)}>Large</button>
        </div>
      </div>
    </section>
  );
}

function FeatureVisibilityPreferences({ profile, onSave }: { profile: Profile; onSave: (profile: Profile) => void }) {
  const toggle = (feature: HabitFeature) => onSave({ ...profile, enabledHabitFeatures: toggleHabitFeature(profile.enabledHabitFeatures, feature) });
  const waterEnabled = isHabitFeatureEnabled(profile.enabledHabitFeatures, habitFeatures.water);
  const fastingEnabled = isHabitFeatureEnabled(profile.enabledHabitFeatures, habitFeatures.fasting);
  const planEnabled = profile.planEnabled ?? false;
  return <section className="display-section habit-visibility-preferences">
    <div className="section-heading"><div><span className="eyebrow">Optional features</span><h2>What appears in your flow</h2></div></div>
    <p className="display-subsection-description">Choose which optional tools appear in Calorie Flow. Turning one off keeps its saved data private and intact.</p>
    <div className="habit-visibility-options">
      <button className={`display-preference ${planEnabled ? "active" : ""}`} type="button" aria-pressed={planEnabled} onClick={() => onSave({ ...profile, planEnabled: !planEnabled })}><span><strong>{planEnabled ? "Plan is shown" : "Plan is hidden"}</strong><small>{planEnabled ? "Keep recipes, meal planning, and shopping lists in your navigation." : "Recipes, planning, and shopping lists stay saved until you show Plan again."}</small></span><span className="toggle" /></button>
      <button className={`display-preference ${waterEnabled ? "active" : ""}`} type="button" aria-pressed={waterEnabled} onClick={() => toggle(habitFeatures.water)}><span><strong>{waterEnabled ? "Water is shown" : "Water is hidden"}</strong><small>{waterEnabled ? "Keep hydration within easy reach on Today." : "Your logged water stays saved until you show it again."}</small></span><span className="toggle" /></button>
      <button className={`display-preference ${fastingEnabled ? "active" : ""}`} type="button" aria-pressed={fastingEnabled} onClick={() => toggle(habitFeatures.fasting)}><span><strong>{fastingEnabled ? "Fasting is shown" : "Fasting is hidden"}</strong><small>{fastingEnabled ? "Keep your optional eating-window check-in on Today." : "Your fasting history stays saved until you show it again."}</small></span><span className="toggle" /></button>
    </div>
  </section>;
}

const weekdayOptions: Array<{ value: Weekday; label: string }> = [
  { value: "monday", label: "Monday" }, { value: "tuesday", label: "Tuesday" }, { value: "wednesday", label: "Wednesday" }, { value: "thursday", label: "Thursday" }, { value: "friday", label: "Friday" }, { value: "saturday", label: "Saturday" }, { value: "sunday", label: "Sunday" },
];

function CarbDisplayPreference({ profile, onSave }: { profile: Profile; onSave: (profile: Profile) => void }) {
  const net = profile.carbDisplay === "net";
  return <section className="display-section">
    <div className="section-heading"><div><span className="eyebrow">Nutrition display</span><h2>Carbohydrates</h2></div></div>
    <button className={`display-preference ${net ? "active" : ""}`} type="button" aria-pressed={net} onClick={() => onSave({ ...profile, carbDisplay: net ? "total" : "net" })}><span><strong>{net ? "Showing net carbs" : "Showing total carbs"}</strong><small>{net ? "Fibre is subtracted from carbohydrates throughout your diary." : "Show the full carbohydrate value from each food label."}</small></span><span className="toggle" /></button>
  </section>;
}

function DailyTargetPreferences({ profile, onSave }: { profile: Profile; onSave: (profile: Profile) => void }) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<Weekday>("monday");
  const current = profile.dailyTargets?.[day];
  const base = { calories: profile.calorieTarget, protein: profile.proteinTarget, carbs: profile.carbsTarget, fat: profile.fatTarget, fiber: profile.fiberTarget };
  const [draft, setDraft] = useState(current || base);
  const resetDraft = (nextDay: Weekday) => setDraft(profile.dailyTargets?.[nextDay] || base);
  const change = (key: keyof typeof draft, value: string) => setDraft((valueState) => ({ ...valueState, [key]: Math.max(0, Number(value)) }));
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!Object.values(draft).every((value) => Number.isFinite(value)) || draft.calories <= 0) return;
    onSave({ ...profile, dailyTargets: { ...profile.dailyTargets, [day]: draft } });
    setOpen(false);
  };
  const clear = () => {
    const remaining = { ...profile.dailyTargets };
    delete remaining[day];
    onSave({ ...profile, dailyTargets: Object.keys(remaining).length ? remaining : undefined });
    setOpen(false);
  };
  const configured = Object.keys(profile.dailyTargets || {}).length;
  return <section className="display-section daily-target-preferences">
    <div className="section-heading"><div><span className="eyebrow">Flexible rhythm</span><h2>Targets by day</h2></div></div>
    <p className="display-subsection-description">Keep a different plan for a rest day, weekend, or regular routine. Unset days use your baseline targets.</p>
    <button className={`display-preference ${configured ? "active" : ""}`} type="button" aria-expanded={open} onClick={() => { if (!open) resetDraft(day); setOpen((value) => !value); }}><span><strong>{configured ? `${configured} day${configured === 1 ? "" : "s"} customised` : "Use the same targets every day"}</strong><small>Change a day without rewriting your usual plan.</small></span><ChevronDown size={18} aria-hidden="true" /></button>
    {open && <form className="weekday-target-editor" onSubmit={save}>
      <label><span>Day</span><ThemedSelect ariaLabel="Day with custom targets" value={day} onChange={(value) => { const nextDay = value as Weekday; setDay(nextDay); resetDraft(nextDay); }} options={weekdayOptions} /></label>
      <div className="form-grid two"><label><span>Calories</span><input type="number" required min="1" max="20000" value={draft.calories} onChange={(event) => change("calories", event.target.value)} /></label><label><span>Fibre</span><input type="number" required min="0" max="2000" value={draft.fiber} onChange={(event) => change("fiber", event.target.value)} /></label><label><span>Protein</span><input type="number" required min="0" max="2000" value={draft.protein} onChange={(event) => change("protein", event.target.value)} /></label><label><span>Carbs</span><input type="number" required min="0" max="2000" value={draft.carbs} onChange={(event) => change("carbs", event.target.value)} /></label><label><span>Fat</span><input type="number" required min="0" max="2000" value={draft.fat} onChange={(event) => change("fat", event.target.value)} /></label></div>
      <div className="target-editor-actions"><button className="secondary-button" type="button" onClick={() => setOpen(false)}>Cancel</button>{current && <button className="text-button muted" type="button" onClick={clear}>Reset {weekdayOptions.find((option) => option.value === day)?.label}</button>}<button className="primary-button" type="submit">Save day</button></div>
    </form>}
  </section>;
}

function MealTargetPreferences({ profile, onSave }: { profile: Profile; onSave: (profile: Profile) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Record<MealType, number>>>(profile.mealCalorieTargets || {});
  const resetDraft = () => setDraft(profile.mealCalorieTargets || {});
  const update = (mealType: MealType, value: string) => setDraft((current) => {
    const next = { ...current };
    const target = Number(value);
    if (!value || !Number.isFinite(target) || target <= 0) delete next[mealType];
    else next[mealType] = target;
    return next;
  });
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const valid = Object.values(draft).every((target) => target === undefined || (Number.isFinite(target) && target > 0 && target <= 20_000));
    if (!valid) return;
    onSave({ ...profile, mealCalorieTargets: Object.keys(draft).length ? draft : undefined });
    setOpen(false);
  };
  const configured = Object.keys(profile.mealCalorieTargets || {}).length;
  return <section className="display-section meal-target-preferences">
    <div className="section-heading"><div><span className="eyebrow">Meal rhythm</span><h2>Meal calorie guides</h2></div></div>
    <p className="display-subsection-description">Optional meal guides sit alongside your daily target. They never block logging or change your daily total.</p>
    <button className={`display-preference ${configured ? "active" : ""}`} type="button" aria-expanded={open} onClick={() => { if (!open) resetDraft(); setOpen((value) => !value); }}><span><strong>{configured ? `${configured} meal${configured === 1 ? "" : "s"} guided` : "Set a guide for each meal"}</strong><small>See a chosen calorie range beside breakfast, lunch, dinner, or snacks.</small></span><ChevronDown size={18} aria-hidden="true" /></button>
    {open && <form className="weekday-target-editor" onSubmit={save}><div className="form-grid two">{(Object.keys(mealLabels) as MealType[]).map((mealType) => <label key={mealType}><span>{mealLabels[mealType]} calories <small>Optional</small></span><input type="number" inputMode="numeric" min="1" max="20000" value={draft[mealType] || ""} onChange={(event) => update(mealType, event.target.value)} placeholder="No guide" /></label>)}</div><div className="target-editor-actions"><button className="secondary-button" type="button" onClick={() => setOpen(false)}>Cancel</button>{configured && <button className="text-button muted" type="button" onClick={() => { onSave({ ...profile, mealCalorieTargets: undefined }); setOpen(false); }}>Clear guides</button>}<button className="primary-button" type="submit">Save meal guides</button></div></form>}
  </section>;
}

function MeasurementPreferences({ profile, onChange }: { profile: Profile; onChange: (measurementSystem: Profile["measurementSystem"]) => void }) {
  const measurementSystem = measurementSystemFor(profile);
  return (
    <section className="display-section">
      <div className="section-heading"><div><span className="eyebrow">Measurements</span><h2>Units</h2></div></div>
      <p className="display-subsection-description">Choose how height and body weight appear throughout Calorie Flow.</p>
      <div className="unit-choice-grid" role="group" aria-label="Measurement units">
        <button type="button" aria-pressed={measurementSystem === measurementSystems.metric} className={`unit-choice${measurementSystem === measurementSystems.metric ? " active" : ""}`} onClick={() => onChange(measurementSystems.metric)}><span><strong>Metric</strong><small>Centimetres · kilograms</small></span>{measurementSystem === measurementSystems.metric && <Check size={18} aria-hidden="true" />}</button>
        <button type="button" aria-pressed={measurementSystem === measurementSystems.imperial} className={`unit-choice${measurementSystem === measurementSystems.imperial ? " active" : ""}`} onClick={() => onChange(measurementSystems.imperial)}><span><strong>US customary</strong><small>Inches · pounds</small></span>{measurementSystem === measurementSystems.imperial && <Check size={18} aria-hidden="true" />}</button>
      </div>
    </section>
  );
}

function WeightTrackingPreference({ status, onChange }: { status?: WeightTrackingStatus; onChange: (status: WeightTrackingStatus) => void }) {
  const enabled = status === weightTrackingStatuses.enabled;
  return (
    <section className="display-section">
      <div className="section-heading"><div><span className="eyebrow">Optional progress</span><h2>Weight tracking</h2></div></div>
      <button className={`display-preference ${enabled ? "active" : ""}`} type="button" aria-pressed={enabled} onClick={() => onChange(enabled ? weightTrackingStatuses.disabled : weightTrackingStatuses.enabled)}><span><strong>{enabled ? "Weight tracking is on" : "Weight tracking is off"}</strong><small>{enabled ? "Show averages and daily weigh-ins in Insights." : "Turn it on here anytime to add weight averages to Insights."}</small></span><span className="toggle" /></button>
    </section>
  );
}

function AppearancePreferences({ theme, onChange }: { theme: ThemeMode; onChange: (theme: ThemeMode) => void }) {
  return (
    <section className="display-section appearance-section">
      <div className="section-heading"><div><span className="eyebrow">Appearance</span><h2>Theme</h2></div></div>
      <div className="theme-choice" role="group" aria-label="Colour theme">
        <button className={theme === themeModes.light ? "active" : ""} type="button" aria-pressed={theme === themeModes.light} onClick={() => onChange(themeModes.light)}><Sun size={17} /><span><strong>Light</strong><small>Warm and clear for everyday meals</small></span></button>
        <button className={theme === themeModes.dark ? "active" : ""} type="button" aria-pressed={theme === themeModes.dark} onClick={() => onChange(themeModes.dark)}><Moon size={17} /><span><strong>Dark</strong><small>Quieter for late-night logging</small></span></button>
      </div>
    </section>
  );
}

function ProfileIdentity({ profile, user, onSave }: { profile: Profile; user: CloudUser | null; onSave: (profile: Profile) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name || accountDisplayName(user) || "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [notice, setNotice] = useState("");
  const fallbackAvatar = providerAvatarUrl(user);
  const visibleAvatar = avatarUrl || fallbackAvatar;
  const initials = (name.trim() || user?.email?.split("@")[0] || "You").slice(0, 1).toUpperCase();

  const save = () => {
    onSave({ ...profile, name: name.trim(), avatarUrl });
    setEditing(false);
    setNotice("Profile saved");
  };
  const cancel = () => {
    setName(profile.name || accountDisplayName(user) || "");
    setAvatarUrl(profile.avatarUrl);
    setEditing(false);
    setNotice("");
  };
  const edit = () => {
    setNotice("");
    setEditing(true);
  };
  const chooseAvatar = async (file?: File) => {
    if (!file) return;
    try {
      const nextAvatar = await resizeAvatar(file);
      setAvatarUrl(nextAvatar);
      setNotice("");
    } catch {
      setNotice("That image could not be used. Try another photo.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const removeCustomAvatar = () => {
    setAvatarUrl(undefined);
    setNotice("");
  };

  return (
    <section className="profile-identity" aria-labelledby="profile-identity-heading">
      <div className="section-heading">
        <div><span className="eyebrow">About you</span><h2 id="profile-identity-heading">Profile</h2></div>
        {!editing && <button className="icon-button ghost profile-edit-button" type="button" onClick={edit} aria-label="Edit profile"><Pencil size={17} /></button>}
      </div>
      {editing ? <>
        <div className="profile-identity-editor">
          <button className="avatar-picker" type="button" onClick={() => fileRef.current?.click()} aria-label="Choose a profile photo">
            {visibleAvatar ? <img src={visibleAvatar} alt="" /> : <span>{initials}</span>}
            <i><Upload size={14} /></i>
          </button>
          <div className="profile-identity-fields">
            <label><span>Display name</span><input autoFocus value={name} maxLength={120} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label>
            <small>{user ? "Your account photo is used by default. Upload a different one whenever you like." : "Add a name and photo so this diary feels like yours."}</small>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => void chooseAvatar(event.target.files?.[0])} />
        <div className="profile-identity-actions">
          <button className="secondary-button" type="button" onClick={cancel}>Cancel</button>
          <button className="primary-button" type="button" onClick={save}>Save profile</button>
          {avatarUrl && <button className="text-button muted" type="button" onClick={removeCustomAvatar}>Use default photo</button>}
        </div>
      </> : <div className="profile-identity-summary">
        <div className="profile-avatar" aria-hidden="true">{visibleAvatar ? <img src={visibleAvatar} alt="" /> : <span>{initials}</span>}</div>
        <div><span className="profile-identity-label">Display name</span><strong>{name || "Add your name"}</strong><small>{user ? "Your account photo is used by default." : "Add a name and photo so this diary feels like yours."}</small></div>
      </div>}
      {notice && <p className="account-notice" role="status">{notice}</p>}
    </section>
  );
}

function AccountCard({
  user,
  syncState,
  onSignOut,
}: {
  user: CloudUser | null;
  syncState: SyncState;
  onSignOut: () => Promise<void>;
}) {
  const statusText: Record<SyncState, string> = {
    local: "Saved on this device",
    syncing: "Syncing changes…",
    synced: "Up to date across devices",
    offline: "Saved offline · will retry",
    error: "Sync needs attention",
  };
  return (
    <section className="account-section">
      <div className="section-heading"><div><span className="eyebrow">Private account</span><h2>Account & sync</h2></div></div>
      <div className="account-card card">
        {user ? (
          <>
            <div className="account-user"><span><Cloud size={20} /></span><div><strong>{user.email || "Signed-in account"}</strong><small>{statusText[syncState]}</small></div></div>
            <button className="secondary-button" onClick={onSignOut}><LogOut size={17} />Sign out</button>
          </>
        ) : <div className="account-message"><Cloud /><div><strong>Account required</strong><p>Sign in to keep your diary private and available across devices.</p></div></div>}
      </div>
    </section>
  );
}

function DiarySharing({ user }: { user: CloudUser | null }) {
  const [shares, setShares] = useState<DiaryShare[]>([]);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(Boolean(user));
  const [sending, setSending] = useState(false);
  const [activeShare, setActiveShare] = useState<DiaryShare | null>(null);
  const [sharedDiary, setSharedDiary] = useState<Awaited<ReturnType<typeof getSharedDiarySnapshot>> | null>(null);

  const loadShares = useCallback(async () => {
    if (!user) { setShares([]); setLoading(false); return; }
    setLoading(true);
    try {
      setShares(await getCloudDiaryShares());
    } catch {
      setNotice("Couldn’t load diary sharing. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void loadShares(); });
    return () => window.cancelAnimationFrame(frame);
  }, [loadShares]);

  const invite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setSending(true); setNotice("");
    try {
      const share = await inviteCloudDiaryShare(user.id, user.email, recipientEmail);
      setShares((current) => [share, ...current]);
      setRecipientEmail("");
      setNotice(`Invitation ready for ${share.recipientEmail}. They’ll need to sign in with that address to accept it.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Couldn’t create that invitation.");
    } finally {
      setSending(false);
    }
  };

  const accept = async (share: DiaryShare) => {
    setNotice("");
    try {
      const accepted = await acceptCloudDiaryShare(share.id);
      setShares((current) => current.map((item) => item.id === accepted.id ? accepted : item));
      setNotice("You can now view this shared diary. It stays read-only.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Couldn’t accept that invitation.");
    }
  };

  const revoke = async (share: DiaryShare) => {
    if (!user) return;
    setNotice("");
    try {
      await revokeCloudDiaryShare(user.id, share.id);
      setShares((current) => current.map((item) => item.id === share.id ? { ...item, status: "revoked", recipientId: undefined, revokedAt: new Date().toISOString() } : item));
      setNotice("Access revoked. That diary is no longer visible to them.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Couldn’t revoke this share.");
    }
  };

  const openSharedDiary = async (share: DiaryShare) => {
    setActiveShare(share); setSharedDiary(null); setNotice("");
    try {
      setSharedDiary(await getSharedDiarySnapshot(share));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Couldn’t open this shared diary.");
      setActiveShare(null);
    }
  };

  const sent = shares.filter((share) => share.ownerId === user?.id);
  const received = shares.filter((share) => share.ownerId !== user?.id);
  const recentMeals = sharedDiary?.meals
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 12) || [];

  return <section className="sharing-section" aria-labelledby="diary-sharing-heading">
    <div className="section-heading"><div><span className="eyebrow">Private accountability</span><h2 id="diary-sharing-heading">Share a read-only diary</h2></div></div>
    <div className="sharing-card card">
      <div className="sharing-intro"><span className="sharing-icon"><Share2 size={19} /></span><div><strong>Invite people you trust</strong><p>Only the invited email can accept. They can see meals and saved foods, never your targets, profile, Coach, or edit controls.</p></div></div>
      {user ? <form className="sharing-invite" onSubmit={invite}>
        <label><span>Invite by email</span><input type="email" autoComplete="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} placeholder="friend@example.com" required /></label>
        <button className="secondary-button" type="submit" disabled={sending}>{sending ? "Sending…" : "Create invitation"}</button>
      </form> : <p className="sharing-signed-out">Sign in to create or receive a private diary invitation.</p>}
      {notice && <p className="sharing-notice" role="status">{notice}</p>}
      {user && <div className="sharing-lists">
        <div><span className="sharing-list-label">Sent invitations</span>{loading ? <p className="sharing-empty">Loading invitations…</p> : sent.length ? <div className="sharing-list">{sent.map((share) => <div key={share.id} className="sharing-row"><div><strong>{share.recipientEmail}</strong><small>{share.status === "accepted" ? "Viewing your diary" : share.status === "pending" ? "Waiting to accept" : "Access revoked"}</small></div>{share.status !== "revoked" && <button className="text-button danger-hover" type="button" onClick={() => void revoke(share)}>Revoke</button>}</div>)}</div> : <p className="sharing-empty">No invitations sent.</p>}</div>
        <div><span className="sharing-list-label">Shared with you</span>{loading ? <p className="sharing-empty">Loading invitations…</p> : received.length ? <div className="sharing-list">{received.map((share) => <div key={share.id} className="sharing-row"><div><strong>Private diary</strong><small>{share.status === "pending" ? `Invitation for ${share.recipientEmail}` : share.status === "accepted" ? "Read-only access" : "Access revoked"}</small></div>{share.status === "pending" ? <button className="secondary-button compact" type="button" onClick={() => void accept(share)}>Accept</button> : share.status === "accepted" ? <button className="secondary-button compact" type="button" onClick={() => void openSharedDiary(share)}>View diary</button> : null}</div>)}</div> : <p className="sharing-empty">No one has shared a diary with you.</p>}</div>
      </div>}
    </div>
    {activeShare && <Sheet label="Shared diary" onClose={() => { setActiveShare(null); setSharedDiary(null); }}>
      <div className="shared-diary-sheet"><div className="sheet-header"><div><span className="eyebrow">Read-only diary</span><h2>Shared meals</h2></div><span /></div>{sharedDiary ? <><p>Recent entries shared privately with you. You cannot edit, copy over, or expose this diary to anyone else.</p>{recentMeals.length ? <div className="card shared-meal-list">{recentMeals.map((meal) => <div key={meal.id}><div><strong>{meal.name}</strong><small>{meal.mealType} · {new Date(meal.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small></div><span>{meal.nutrition.protein.toFixed(0)} g protein</span></div>)}</div> : <p className="sharing-empty">There are no meals in this diary yet.</p>}</> : <p className="sharing-empty">Opening shared diary…</p>}</div>
    </Sheet>}
  </section>;
}

export function ProfileView({
  profile,
  onSave,
  onRestartOnboarding,
  onExport,
  onImport,
  user,
  syncState,
  onSignOut,
  theme,
  onThemeChange,
  chatTextSize,
  onChatTextSizeChange,
  weightTracking,
}: {
  profile: Profile;
  onSave: (profile: Profile) => void;
  onRestartOnboarding: () => void;
  onExport: () => Promise<BackupData>;
  onImport: (data: BackupData, mode: "merge" | "replace") => Promise<void>;
  user: CloudUser | null;
  syncState: SyncState;
  onSignOut: () => Promise<void>;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  chatTextSize: ChatTextSize;
  onChatTextSizeChange: (size: ChatTextSize) => void;
  weightTracking?: WeightTrackingStatus;
}) {
  const importRef = useRef<HTMLInputElement>(null);
  const [editingTargets, setEditingTargets] = useState(false);
  const [profileSection, setProfileSection] = useState<ProfileSection>("profile");
  const targetDisclosureRef = useDismissibleDisclosure<HTMLDivElement>(editingTargets, () => setEditingTargets(false));
  const [dataToolsOpen, setDataToolsOpen] = useState(false);
  const dataToolsRef = useDismissibleDisclosure<HTMLDetailsElement>(dataToolsOpen, () => setDataToolsOpen(false));
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace">("merge");
  const [backupNotice, setBackupNotice] = useState("");
  const [exporting, setExporting] = useState(false);
  const downloadCsv = async () => {
    setExporting(true); setBackupNotice("");
    try {
      const data = await onExport();
      const url = URL.createObjectURL(new Blob([mealsCsv(data.meals)], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `calorie-flow-meals-${localDateKey()}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      setBackupNotice("Your meal report was downloaded as CSV.");
    } catch {
      setBackupNotice("Couldn’t prepare the meal report. Check your connection and try again.");
    } finally { setExporting(false); }
  };
  const download = async () => {
    setExporting(true); setBackupNotice("");
    try {
      const data = await onExport();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `calorie-flow-${localDateKey()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setBackupNotice("Your data archive was downloaded.");
    } catch {
      setBackupNotice("Couldn’t prepare a complete archive. Check your connection and try again.");
    } finally {
      setExporting(false);
    }
  };
  const upload = async (file?: File) => {
    if (!file) return;
    try {
      const data = validateBackup(JSON.parse(await file.text()));
      if (restoreMode === "replace" && !window.confirm("Replace your current diary, foods, and targets with this backup? This cannot be undone.")) return;
      await onImport(data, restoreMode);
      setBackupNotice(restoreMode === "replace" ? "Backup replaced your current data." : "Backup merged with your current data.");
    } catch {
      setBackupNotice("That file isn’t a valid Calorie Flow backup.");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  };
  return (
    <main className="page">
      <header className="page-header"><span className="eyebrow">Your account</span><h1>{profileSection === "profile" ? "Your profile" : "Make it yours"}</h1><p>{profileSection === "profile" ? "Keep your identity, targets, and private data in one place." : "Tune the parts of Calorie Flow that should work your way."}</p></header>
      <div className="profile-tabs" role="tablist" aria-label="Profile sections">
        <button id="profile-tab" type="button" role="tab" aria-selected={profileSection === "profile"} aria-controls="profile-panel" className={profileSection === "profile" ? "active" : ""} onClick={() => setProfileSection("profile")}>Profile</button>
        <button id="customize-tab" type="button" role="tab" aria-selected={profileSection === "customize"} aria-controls="customize-panel" className={profileSection === "customize" ? "active" : ""} onClick={() => setProfileSection("customize")}>Customize</button>
      </div>
      {profileSection === "profile" ? <div id="profile-panel" role="tabpanel" aria-labelledby="profile-tab" tabIndex={0}>
        <ProfileIdentity key={`${profile.name}:${profile.avatarUrl || ""}`} profile={profile} user={user} onSave={onSave} />
        <div ref={targetDisclosureRef}>
          <TargetSummary profile={profile} expanded={editingTargets} onEdit={() => setEditingTargets((open) => !open)} />
          {editingTargets && <div id="target-editor"><TargetEditor profile={profile} onSave={(next) => { onSave(next); setEditingTargets(false); }} onCancel={() => setEditingTargets(false)} /></div>}
        </div>
        <section className="onboarding-restart" aria-labelledby="onboarding-restart-heading">
          <div><span className="eyebrow">Want a fresh start?</span><h2 id="onboarding-restart-heading">Run setup again</h2><p>Revisit your goals, activity, and nutrition style. Your diary stays safely in place.</p></div>
          <button className="secondary-button" type="button" onClick={onRestartOnboarding}><RotateCcw size={16} />Run setup again</button>
        </section>
        <AccountCard user={user} syncState={syncState} onSignOut={onSignOut} />
        <DiarySharing user={user} />
      </div> : <div id="customize-panel" role="tabpanel" aria-labelledby="customize-tab" tabIndex={0}>
        <section className="customize-intro" aria-labelledby="customize-heading"><div><span className="eyebrow">Your preferences</span><h2 id="customize-heading">A calmer tracker, your way</h2><p>These choices only change how Calorie Flow feels and what it shows. Your diary stays private on this device.</p></div></section>
        <MeasurementPreferences profile={profile} onChange={(measurementSystem) => onSave({ ...profile, measurementSystem })} />
        <DisplayPreferences hideCalories={profile.hideCalories} onChange={(hideCalories) => onSave({ ...profile, hideCalories })} chatTextSize={chatTextSize} onChatTextSizeChange={onChatTextSizeChange} />
        <FeatureVisibilityPreferences profile={profile} onSave={onSave} />
        <CarbDisplayPreference profile={profile} onSave={onSave} />
        <DailyTargetPreferences profile={profile} onSave={onSave} />
        <MealTargetPreferences profile={profile} onSave={onSave} />
        <WeightTrackingPreference status={weightTracking} onChange={(next) => onSave({ ...profile, weightTracking: next })} />
        <AppearancePreferences theme={theme} onChange={onThemeChange} />
      </div>}
      <details ref={dataToolsRef} className="data-tools" open={dataToolsOpen} onToggle={(event) => setDataToolsOpen(event.currentTarget.open)}>
        <summary>
          <ShieldCheck size={17} aria-hidden="true" />
          <span className="data-tools-copy"><strong>Data & privacy</strong><small>Export or restore your information</small></span>
          <ChevronDown className="data-tools-chevron" size={17} aria-hidden="true" />
        </summary>
        <div className="card tool-list">
          <button onClick={download} disabled={exporting}><Download size={19} /><span><strong>{exporting ? "Preparing archive…" : "Export your data"}</strong><small>Diary, foods, targets, and coach history</small></span><ChevronRight size={17} /></button>
          <button onClick={downloadCsv} disabled={exporting}><Download size={19} /><span><strong>{exporting ? "Preparing report…" : "Download meal report"}</strong><small>Meal-level CSV for spreadsheets or printing</small></span><ChevronRight size={17} /></button>
          <div className="restore-tools">
            <div className="restore-mode" role="radiogroup" aria-label="Restore mode">
              <label><input type="radio" name="restore-mode" checked={restoreMode === "merge"} onChange={() => setRestoreMode("merge")} />Merge with current data</label>
              <label><input type="radio" name="restore-mode" checked={restoreMode === "replace"} onChange={() => setRestoreMode("replace")} />Replace current data</label>
            </div>
            <button onClick={() => importRef.current?.click()}><Upload size={19} /><span><strong>Restore a backup</strong><small>Import a Calorie Flow JSON archive</small></span><ChevronRight size={17} /></button>
          </div>
          <input ref={importRef} type="file" accept="application/json" hidden onChange={(event) => upload(event.target.files?.[0])} />
        </div>
        {backupNotice && <p className="backup-notice" role="status">{backupNotice}</p>}
      </details>
    </main>
  );
}

export function OnboardingDialog({ profile, onSave, onCancel }: { profile: Profile; onSave: (profile: Profile) => void; onCancel?: () => void }) {
  const surfaceRef = useModalFocus();
  return (
    <div className="onboarding-overlay">
      <section ref={surfaceRef} className="onboarding-card" role="dialog" aria-modal="true" aria-label="Set up nutrition targets" tabIndex={-1}>
        {onCancel && <button className="onboarding-close icon-button ghost" type="button" aria-label="Cancel setup" onClick={onCancel}><X size={18} /></button>}
        <TargetEditor profile={profile} onSave={onSave} onboarding />
      </section>
    </div>
  );
}

export function WeightTrackingPrompt({ onEnable, onDisable, onDefer }: { onEnable: () => void; onDisable: () => void; onDefer: () => void }) {
  return (
    <Sheet label="Weight tracking" wide onClose={onDefer}>
      <div className="weight-prompt">
        <span className="action-icon mint"><BarChart3 /></span>
        <span className="eyebrow">Optional progress log</span>
        <h2>Want to track your weight?</h2>
        <p>Log daily kilograms and see weekly or monthly averages in Insights. Your entries stay private on this device unless you choose account sync.</p>
        <div className="weight-prompt-actions"><button className="primary-button" type="button" onClick={onEnable}>Yes, track my weight<ChevronRight size={17} /></button><button className="secondary-button" type="button" onClick={onDefer}>Not now</button><button className="text-button muted" type="button" onClick={onDisable}>No, don’t track my weight</button></div>
      </div>
    </Sheet>
  );
}

export function MeasurementPreferencePrompt({ profile, onSave }: { profile: Profile; onSave: (profile: Profile) => void }) {
  return (
    <Sheet label="Measurement preferences" wide showClose={false} onClose={() => undefined}>
      <div className="weight-prompt">
        <span className="action-icon blue"><Utensils /></span>
        <span className="eyebrow">One last preference</span>
        <h2>Which measurements feel natural?</h2>
        <p>Choose how Calorie Flow should show your height and body weight. Calculations stay accurate behind the scenes.</p>
        <div className="weight-prompt-actions">
          <button className="primary-button" type="button" onClick={() => onSave({ ...profile, measurementSystem: measurementSystems.metric })}>Metric (cm, kg)<ChevronRight size={17} /></button>
          <button className="secondary-button" type="button" onClick={() => onSave({ ...profile, measurementSystem: measurementSystems.imperial })}>US customary (in, lb)<ChevronRight size={17} /></button>
        </div>
      </div>
    </Sheet>
  );
}
