"use client";

import { CalendarRange, ChevronRight, Droplet, EyeOff, Moon, Scale, Sparkles, Sun, Timer, Wheat } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { isHabitFeatureEnabled, toggleHabitFeature } from "@/lib/habit-settings";
import type { DailyTargets, MealType, Profile, Weekday } from "@/lib/types";
import { fastingLateMealBehaviors, fastingTrackingModes, habitFeatures, measurementSystems, weightTrackingStatuses } from "@/lib/types";
import type { NutritionTargetKey } from "@/lib/types";
import { NutritionGoalFields } from "./NutritionGoalFields";

type ThemeMode = "light" | "dark";
type ChatTextSize = "compact" | "comfortable" | "large";

const weekdays: Array<{ key: Weekday; label: string }> = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
];

const meals: Array<{ key: MealType; label: string; share: number }> = [
  { key: "breakfast", label: "Breakfast", share: 25 },
  { key: "lunch", label: "Lunch", share: 30 },
  { key: "dinner", label: "Dinner", share: 33 },
  { key: "snack", label: "Snacks", share: 12 },
];

function ToggleRow({ icon: Icon, tone, title, detail, checked, onChange }: { icon: LucideIcon; tone: "mint" | "carbs" | "blue" | "fat" | "muted"; title: string; detail: string; checked: boolean; onChange: () => void }) {
  return <label className="profile-toggle-row"><span className={`profile-link-icon ${tone}`}><Icon /></span><span><strong>{title}</strong><small>{detail}</small></span><input className="profile-switch" type="checkbox" checked={checked} onChange={onChange} /></label>;
}

function baseTargets(profile: Profile): DailyTargets {
  return { calories: profile.calorieTarget, protein: profile.proteinTarget, carbs: profile.carbsTarget, fat: profile.fatTarget, fiber: profile.fiberTarget };
}

function defaultDailyTargets(profile: Profile) {
  const base = baseTargets(profile);
  return Object.fromEntries(weekdays.map(({ key }) => [key, base])) as Record<Weekday, DailyTargets>;
}

function defaultMealTargets(profile: Profile) {
  return Object.fromEntries(meals.map(({ key, share }) => [key, Math.round(profile.calorieTarget * share / 100)])) as Record<MealType, number>;
}

export function ProfileCustomize({ profile, onSave, theme, onThemeChange, chatTextSize, onChatTextSizeChange }: { profile: Profile; onSave: (profile: Profile) => void; theme: ThemeMode; onThemeChange: (theme: ThemeMode) => void; chatTextSize: ChatTextSize; onChatTextSizeChange: (size: ChatTextSize) => void }) {
  const waterEnabled = isHabitFeatureEnabled(profile.enabledHabitFeatures, habitFeatures.water);
  const fastingEnabled = isHabitFeatureEnabled(profile.enabledHabitFeatures, habitFeatures.fasting);
  const weightEnabled = profile.weightTracking === weightTrackingStatuses.enabled;
  const perDayTargets = Boolean(profile.dailyTargets && Object.keys(profile.dailyTargets).length);
  const mealGuides = Boolean(profile.mealCalorieTargets && Object.keys(profile.mealCalorieTargets).length);
  const preciseTiming = profile.fastingTrackingMode === fastingTrackingModes.precise;
  const lateEntriesEndFast = profile.fastingLateMealBehavior === fastingLateMealBehaviors.new;
  const measurementSystem = profile.measurementSystem || measurementSystems.metric;
  const saveHabit = (feature: typeof habitFeatures[keyof typeof habitFeatures]) => onSave({ ...profile, enabledHabitFeatures: toggleHabitFeature(profile.enabledHabitFeatures, feature) });
  const dayTargets = profile.dailyTargets || {};
  const maxDayCalories = Math.max(profile.calorieTarget, ...Object.values(dayTargets).map((target) => target?.calories || 0));
  const mealTargets = profile.mealCalorieTargets || {};
  const saveNutritionGoal = (key: NutritionTargetKey, value: number) => onSave({ ...profile, [key]: value });

  return <div className="profile-customize">
    <h2 className="profile-section-label">What you see</h2>
    <section className="profile-toggle-card">
      <ToggleRow icon={EyeOff} tone="muted" title="Hide calorie numbers" detail="Track macros only — calories disappear everywhere" checked={profile.hideCalories} onChange={() => onSave({ ...profile, hideCalories: !profile.hideCalories })} />
      <ToggleRow icon={Wheat} tone="carbs" title="Show net carbs" detail="Subtract fibre from total carbohydrate" checked={profile.carbDisplay === "net"} onChange={() => onSave({ ...profile, carbDisplay: profile.carbDisplay === "net" ? "total" : "net" })} />
      <ToggleRow icon={Sparkles} tone="blue" title="Flag estimated entries" detail="Mark anything a photo or the coach estimated" checked={profile.showEstimatedBadges !== false} onChange={() => onSave({ ...profile, showEstimatedBadges: profile.showEstimatedBadges === false })} />
    </section>

    <h2 className="profile-section-label">Optional features</h2>
    <p className="profile-section-help">Turn off anything you don&apos;t use and it disappears from the app.</p>
    <section className="profile-toggle-card">
      <ToggleRow icon={CalendarRange} tone="mint" title="Plan" detail="Weekly meal plan, recipes and shopping list" checked={profile.planEnabled ?? true} onChange={() => onSave({ ...profile, planEnabled: !(profile.planEnabled ?? true) })} />
      <ToggleRow icon={Droplet} tone="blue" title="Water" detail="A hydration tracker on Today" checked={waterEnabled} onChange={() => saveHabit(habitFeatures.water)} />
      <ToggleRow icon={Timer} tone="carbs" title="Fasting" detail="Track eating windows between meals" checked={fastingEnabled} onChange={() => saveHabit(habitFeatures.fasting)} />
      <ToggleRow icon={Scale} tone="fat" title="Weight" detail="Weigh-ins, trend and history in Insights" checked={weightEnabled} onChange={() => onSave({ ...profile, weightTracking: weightEnabled ? weightTrackingStatuses.disabled : weightTrackingStatuses.enabled })} />
    </section>

    {fastingEnabled && <section className="profile-settings-card profile-fasting-settings">
      <strong>Fasting settings</strong>
      <span className="profile-setting-label">Daily goal</span>
      <div className="profile-segmented four" role="group" aria-label="Daily fasting goal">{([12, 14, 16, 18] as const).map((hours) => <button type="button" key={hours} className={(profile.fastingGoalHours || 16) === hours ? "active" : ""} onClick={() => onSave({ ...profile, fastingGoalHours: hours })}>{hours} h</button>)}</div>
      <label className="profile-simple-toggle"><span><strong>Precise timing</strong><small>Use exact log times instead of rounding to the hour</small></span><input className="profile-switch" type="checkbox" checked={preciseTiming} onChange={() => onSave({ ...profile, fastingTrackingMode: preciseTiming ? fastingTrackingModes.standard : fastingTrackingModes.precise })} /></label>
      <label className="profile-simple-toggle"><span><strong>Late entries end a fast</strong><small>A meal logged after midnight closes the current fast</small></span><input className="profile-switch" type="checkbox" checked={lateEntriesEndFast} onChange={() => onSave({ ...profile, fastingLateMealBehavior: lateEntriesEndFast ? fastingLateMealBehaviors.ask : fastingLateMealBehaviors.new })} /></label>
    </section>}

    <h2 className="profile-section-label">Additional nutrition goals</h2>
    <details className="profile-settings-card nutrition-goals-advanced">
      <summary><span><strong>Set nutrient guides</strong><small>Sugar, saturated fat, sodium and potassium</small></span><ChevronRight size={16} /></summary>
      <NutritionGoalFields profile={profile} onChange={saveNutritionGoal} />
    </details>

    <h2 className="profile-section-label">Targets by day</h2>
    <section className="profile-settings-card">
      <label className="profile-simple-toggle"><span><strong>Different targets per weekday</strong><small>Eat more on training days, less on rest days</small></span><input className="profile-switch" type="checkbox" checked={perDayTargets} onChange={() => onSave({ ...profile, dailyTargets: perDayTargets ? undefined : defaultDailyTargets(profile) })} /></label>
      {perDayTargets && <div className="profile-day-targets">{weekdays.map(({ key, label }) => { const calories = dayTargets[key]?.calories || profile.calorieTarget; return <div key={key}><span>{label}</span><i><b style={{ width: `${Math.round(calories / Math.max(1, maxDayCalories) * 100)}%` }} /></i><strong>{calories} kcal</strong></div>; })}</div>}
    </section>

    <h2 className="profile-section-label">Meal guides</h2>
    <section className="profile-settings-card">
      <label className="profile-simple-toggle"><span><strong>Show a guide per meal</strong><small>Split your daily target across breakfast, lunch, dinner and snacks</small></span><input className="profile-switch" type="checkbox" checked={mealGuides} onChange={() => onSave({ ...profile, mealCalorieTargets: mealGuides ? undefined : defaultMealTargets(profile) })} /></label>
      {mealGuides && <div className="profile-meal-guides">{meals.map(({ key, label, share }) => <div key={key}><span>{label}</span><strong>{mealTargets[key] || Math.round(profile.calorieTarget * share / 100)} kcal · {share}%</strong></div>)}</div>}
    </section>

    <h2 className="profile-section-label">Units</h2>
    <div className="profile-choice-card two" role="group" aria-label="Measurement units">
      <button type="button" aria-pressed={measurementSystem === measurementSystems.metric} className={measurementSystem === measurementSystems.metric ? "active" : ""} onClick={() => onSave({ ...profile, measurementSystem: measurementSystems.metric })}>Metric (kg, cm)</button>
      <button type="button" aria-pressed={measurementSystem === measurementSystems.imperial} className={measurementSystem === measurementSystems.imperial ? "active" : ""} onClick={() => onSave({ ...profile, measurementSystem: measurementSystems.imperial })}>Imperial (lb, in)</button>
    </div>

    <h2 className="profile-section-label">Appearance</h2>
    <div className="profile-choice-card two" role="group" aria-label="Colour theme">
      <button type="button" aria-pressed={theme === "light"} className={theme === "light" ? "active" : ""} onClick={() => onThemeChange("light")}><Sun />Light</button>
      <button type="button" aria-pressed={theme === "dark"} className={theme === "dark" ? "active" : ""} onClick={() => onThemeChange("dark")}><Moon />Dark</button>
    </div>
    <section className="profile-settings-card profile-text-size">
      <span className="profile-setting-label">Coach text size</span>
      <div className="profile-segmented three" role="group" aria-label="Coach text size">{(["compact", "comfortable", "large"] as const).map((size) => <button type="button" key={size} aria-pressed={chatTextSize === size} className={chatTextSize === size ? "active" : ""} onClick={() => onChatTextSizeChange(size)}>{size === "comfortable" ? "Regular" : `${size[0].toUpperCase()}${size.slice(1)}`}</button>)}</div>
    </section>
  </div>;
}
