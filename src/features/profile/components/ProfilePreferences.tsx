"use client";

import { Check, ChevronDown, Moon, Sun } from "lucide-react";
import { type FormEvent, useState } from "react";
import { ThemedSelect } from "@/features/shared/ThemedSelect";
import { NumericInput } from "@/features/shared/NumericInput";
import { isHabitFeatureEnabled, toggleHabitFeature } from "@/lib/habit-settings";
import type { FastingLateMealBehavior, FastingTrackingMode, HabitFeature, MealType, Profile, WeightTrackingStatus, Weekday } from "@/lib/types";
import { fastingLateMealBehaviors, fastingTrackingModes, habitFeatures, measurementSystems, weightTrackingStatuses } from "@/lib/types";

type ThemeMode = "light" | "dark";
type ChatTextSize = "compact" | "comfortable" | "large";
const chatTextSizes = { compact: "compact", comfortable: "comfortable", large: "large" } as const;
const themeModes = { light: "light", dark: "dark" } as const;
const mealLabels: Record<MealType, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };
const measurementSystemFor = (profile: Profile) => profile.measurementSystem || measurementSystems.metric;

export function DisplayPreferences({ hideCalories, onChange, chatTextSize, onChatTextSizeChange }: { hideCalories: boolean; onChange: (hideCalories: boolean) => void; chatTextSize: ChatTextSize; onChatTextSizeChange: (size: ChatTextSize) => void }) {
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

export function FeatureVisibilityPreferences({ profile, onSave }: { profile: Profile; onSave: (profile: Profile) => void }) {
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

export function FastingPreferences({ profile, onSave }: { profile: Profile; onSave: (profile: Profile) => void }) {
  const mode = profile.fastingTrackingMode || fastingTrackingModes.standard;
  const window = profile.fastingMealWindowMinutes || 30;
  const behavior = profile.fastingLateMealBehavior || fastingLateMealBehaviors.ask;
  const setMode = (nextMode: FastingTrackingMode) => onSave({ ...profile, fastingTrackingMode: nextMode });
  const setBehavior = (nextBehavior: FastingLateMealBehavior) => onSave({ ...profile, fastingLateMealBehavior: nextBehavior });
  return <section className="display-section fasting-preferences">
    <div className="section-heading"><div><span className="eyebrow">Fasting detail</span><h2>How should meals be timed?</h2></div></div>
    <p className="display-subsection-description">Choose whether Calorie Flow groups normal meal logging or treats each logged food as a precise interruption.</p>
    <div className="segmented two" role="group" aria-label="Fasting tracking detail">
      <button type="button" aria-pressed={mode === fastingTrackingModes.standard} className={mode === fastingTrackingModes.standard ? "active" : ""} onClick={() => setMode(fastingTrackingModes.standard)}><strong>Standard</strong><small>Smart meal grouping</small></button>
      <button type="button" aria-pressed={mode === fastingTrackingModes.precise} className={mode === fastingTrackingModes.precise ? "active" : ""} onClick={() => setMode(fastingTrackingModes.precise)}><strong>Precise</strong><small>Every logged time counts</small></button>
    </div>
    {mode === fastingTrackingModes.precise ? <p className="fasting-preference-note">Precise mode uses the exact time each food is logged. It is best when you record food as you eat it and want every interruption reflected in your fasting history.</p> : <>
      <div className="display-subsection"><div className="display-subsection-heading"><span className="eyebrow">Meal window</span><h3>Group foods logged within</h3></div><div className="segmented three" role="group" aria-label="Meal grouping window">{([15, 30, 60] as const).map((minutes) => <button key={minutes} type="button" aria-pressed={window === minutes} className={window === minutes ? "active" : ""} onClick={() => onSave({ ...profile, fastingMealWindowMinutes: minutes })}>{minutes} min</button>)}</div></div>
      <div className="display-subsection"><div className="display-subsection-heading"><span className="eyebrow">Late entries</span><h3>When food is logged after the window</h3></div><ThemedSelect ariaLabel="Late food entry behavior" value={behavior} onChange={(value) => setBehavior(value as FastingLateMealBehavior)} options={[{ value: fastingLateMealBehaviors.ask, label: "Ask me each time" }, { value: fastingLateMealBehaviors.new, label: "Always start a new meal" }, { value: fastingLateMealBehaviors.previous, label: "Always add to the previous meal" }]} /></div>
      <p className="fasting-preference-note">Standard mode keeps foods from the same breakfast, lunch, or snack together, even when you log them a few minutes apart.</p>
    </>}
  </section>;
}

const weekdayOptions: Array<{ value: Weekday; label: string }> = [
  { value: "monday", label: "Monday" }, { value: "tuesday", label: "Tuesday" }, { value: "wednesday", label: "Wednesday" }, { value: "thursday", label: "Thursday" }, { value: "friday", label: "Friday" }, { value: "saturday", label: "Saturday" }, { value: "sunday", label: "Sunday" },
];

export function CarbDisplayPreference({ profile, onSave }: { profile: Profile; onSave: (profile: Profile) => void }) {
  const net = profile.carbDisplay === "net";
  return <section className="display-section">
    <div className="section-heading"><div><span className="eyebrow">Nutrition display</span><h2>Carbohydrates</h2></div></div>
    <button className={`display-preference ${net ? "active" : ""}`} type="button" aria-pressed={net} onClick={() => onSave({ ...profile, carbDisplay: net ? "total" : "net" })}><span><strong>{net ? "Showing net carbs" : "Showing total carbs"}</strong><small>{net ? "Fibre is subtracted from carbohydrates throughout your diary." : "Show the full carbohydrate value from each food label."}</small></span><span className="toggle" /></button>
  </section>;
}

export function DailyTargetPreferences({ profile, onSave }: { profile: Profile; onSave: (profile: Profile) => void }) {
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
      <div className="form-grid two"><label><span>Calories</span><NumericInput required min="1" max="20000" value={draft.calories} onChange={(event) => change("calories", event.target.value)} /></label><label><span>Fibre</span><NumericInput required min="0" max="2000" value={draft.fiber} onChange={(event) => change("fiber", event.target.value)} /></label><label><span>Protein</span><NumericInput required min="0" max="2000" value={draft.protein} onChange={(event) => change("protein", event.target.value)} /></label><label><span>Carbs</span><NumericInput required min="0" max="2000" value={draft.carbs} onChange={(event) => change("carbs", event.target.value)} /></label><label><span>Fat</span><NumericInput required min="0" max="2000" value={draft.fat} onChange={(event) => change("fat", event.target.value)} /></label></div>
      <div className="target-editor-actions"><button className="secondary-button" type="button" onClick={() => setOpen(false)}>Cancel</button>{current && <button className="text-button muted" type="button" onClick={clear}>Reset {weekdayOptions.find((option) => option.value === day)?.label}</button>}<button className="primary-button" type="submit">Save day</button></div>
    </form>}
  </section>;
}

export function MealTargetPreferences({ profile, onSave }: { profile: Profile; onSave: (profile: Profile) => void }) {
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
    {open && <form className="weekday-target-editor" onSubmit={save}><div className="form-grid two">{(Object.keys(mealLabels) as MealType[]).map((mealType) => <label key={mealType}><span>{mealLabels[mealType]} calories <small>Optional</small></span><NumericInput inputMode="numeric" min="1" max="20000" value={draft[mealType] || ""} onChange={(event) => update(mealType, event.target.value)} placeholder="No guide" /></label>)}</div><div className="target-editor-actions"><button className="secondary-button" type="button" onClick={() => setOpen(false)}>Cancel</button>{configured && <button className="text-button muted" type="button" onClick={() => { onSave({ ...profile, mealCalorieTargets: undefined }); setOpen(false); }}>Clear guides</button>}<button className="primary-button" type="submit">Save meal guides</button></div></form>}
  </section>;
}

export function MeasurementPreferences({ profile, onChange }: { profile: Profile; onChange: (measurementSystem: Profile["measurementSystem"]) => void }) {
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

export function WeightTrackingPreference({ status, onChange }: { status?: WeightTrackingStatus; onChange: (status: WeightTrackingStatus) => void }) {
  const enabled = status === weightTrackingStatuses.enabled;
  return (
    <section className="display-section">
      <div className="section-heading"><div><span className="eyebrow">Optional progress</span><h2>Weight tracking</h2></div></div>
      <button className={`display-preference ${enabled ? "active" : ""}`} type="button" aria-pressed={enabled} onClick={() => onChange(enabled ? weightTrackingStatuses.disabled : weightTrackingStatuses.enabled)}><span><strong>{enabled ? "Weight tracking is on" : "Weight tracking is off"}</strong><small>{enabled ? "Show averages and daily weigh-ins in Insights." : "Turn it on here anytime to add weight averages to Insights."}</small></span><span className="toggle" /></button>
    </section>
  );
}

export function AppearancePreferences({ theme, onChange }: { theme: ThemeMode; onChange: (theme: ThemeMode) => void }) {
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
