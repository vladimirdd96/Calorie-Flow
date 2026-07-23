"use client";

import { Droplets, Plus, Sparkles, Timer, Trash2, Utensils } from "lucide-react";
import { FormEvent, useState } from "react";
import { localDateKey, round, sumNutrition } from "@/lib/nutrition";
import { hydrationTotal } from "@/lib/hydration";
import { activeFast, fastingWindowHours, formatFastingDuration } from "@/lib/fasting";
import { isHabitFeatureEnabled } from "@/lib/habit-settings";
import { recentLogDates } from "@/lib/logging";
import { NumericInput } from "@/features/shared/NumericInput";
import type { FastingRecord, Meal, MealType, Profile, WeightEntry } from "@/lib/types";
import { habitFeatures, measurementSystems } from "@/lib/types";

type WeightPeriod = "week" | "month" | "all";
type InsightsSection = "overview" | "nutrition" | "weight" | "fasting";

const kgToLb = (kg: number) => kg * 2.2046226218;

const lbToKg = (lb: number) => lb / 2.2046226218;

const measurementSystemFor = (profile: Profile) => profile.measurementSystem || measurementSystems.metric;

const weightUnitFor = (profile: Profile) => measurementSystemFor(profile) === measurementSystems.imperial ? "lb" : "kg";

const formatWeight = (weightKg: number, profile: Profile) => `${(measurementSystemFor(profile) === measurementSystems.imperial ? kgToLb(weightKg) : weightKg).toFixed(1)} ${weightUnitFor(profile)}`;

const mealLabels: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

const fastingDateTime = (value: string) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  return result;
}

export function InsightsView({ meals, profile, onSave, weightTrackingEnabled }: { meals: Meal[]; profile: Profile; onSave: (profile: Profile) => void; weightTrackingEnabled: boolean }) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = localDateKey(date);
    const total = sumNutrition(meals.filter((meal) => (meal.loggedDate || localDateKey(new Date(meal.createdAt))) === key).map((meal) => meal.nutrition));
    return { key, label: date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1), total };
  });
  const max = Math.max(profile.calorieTarget, ...days.map((day) => day.total.calories));
  const loggedDays = days.filter((day) => day.total.calories > 0);
  const average = loggedDays.length ? loggedDays.reduce((sum, day) => sum + day.total.calories, 0) / loggedDays.length : 0;
  const proteinAverage = loggedDays.length ? loggedDays.reduce((sum, day) => sum + day.total.protein, 0) / loggedDays.length : 0;
  const averageNutrition = loggedDays.length ? sumNutrition(loggedDays.map((day) => day.total)) : sumNutrition([]);
  const averageMeals = loggedDays.length ? meals.filter((meal) => days.some((day) => day.key === (meal.loggedDate || localDateKey(new Date(meal.createdAt))))).length / loggedDays.length : 0;
  const mealCounts = (Object.keys(mealLabels) as MealType[]).map((type) => ({ type, count: meals.filter((meal) => meal.mealType === type && days.some((day) => day.key === (meal.loggedDate || localDateKey(new Date(meal.createdAt))))).length }));
  const mostLoggedMeal = mealCounts.slice().sort((a, b) => b.count - a.count)[0];
  const targetDays = profile.hideCalories ? loggedDays.filter((day) => day.total.protein >= profile.proteinTarget * .8).length : loggedDays.filter((day) => day.total.calories >= profile.calorieTarget * .8 && day.total.calories <= profile.calorieTarget * 1.1).length;
  const waterTarget = profile.waterTargetMl || 2000;
  const waterDays = recentLogDates().filter((date) => hydrationTotal(profile.waterEntries, date) >= waterTarget * .8).length;
  const completedFasts = (profile.fastingRecords || []).filter((record) => record.endedAt && fastingWindowHours(record.startedAt, record.endedAt) >= (profile.fastingGoalHours || 16)).length;
  const fastingGoal = profile.fastingGoalHours || 16;
  const activeFasting = activeFast(profile.fastingRecords);
  const completedFastingRecords = [...(profile.fastingRecords || [])]
    .filter((record): record is FastingRecord & { endedAt: string } => Boolean(record.endedAt))
    .sort((a, b) => b.endedAt.localeCompare(a.endedAt));
  const fastingDurations = completedFastingRecords.map((record) => fastingWindowHours(record.startedAt, record.endedAt));
  const averageFast = fastingDurations.length ? fastingDurations.reduce((sum, hours) => sum + hours, 0) / fastingDurations.length : 0;
  const longestFast = fastingDurations.length ? Math.max(...fastingDurations) : 0;
  const goalFasts = fastingDurations.filter((hours) => hours >= fastingGoal).length;
  const [weightPeriod, setWeightPeriod] = useState<WeightPeriod>("week");
  const [section, setSection] = useState<InsightsSection>("overview");
  const entries = [...(profile.weightEntries || [])].sort((a, b) => b.date.localeCompare(a.date));
  const latestWeight = entries[0]?.weightKg ?? profile.weightKg;
  const measurementSystem = measurementSystemFor(profile);
  const [weightDate, setWeightDate] = useState(localDateKey());
  const [weightInput, setWeightInput] = useState(String(measurementSystem === measurementSystems.imperial ? Math.round(kgToLb(latestWeight) * 10) / 10 : latestWeight));
  const periodEntries = entries.filter((entry) => {
    if (weightPeriod === "all") return true;
    const now = new Date();
    const entryDate = new Date(`${entry.date}T12:00:00`);
    if (weightPeriod === "month") return entryDate >= new Date(now.getFullYear(), now.getMonth(), 1);
    return entryDate >= startOfWeek(now);
  });
  const weightAverage = periodEntries.length ? periodEntries.reduce((sum, entry) => sum + entry.weightKg, 0) / periodEntries.length : 0;
  const weightChange = periodEntries.length > 1 ? periodEntries[0].weightKg - periodEntries[periodEntries.length - 1].weightKg : 0;
  const groupedWeights = Array.from(new Map(periodEntries.map((entry) => {
    const date = new Date(`${entry.date}T12:00:00`);
    const key = weightPeriod === "week" ? localDateKey(startOfWeek(date)) : entry.date.slice(0, 7);
    return [key, { key, entries: periodEntries.filter((candidate) => (weightPeriod === "week" ? localDateKey(startOfWeek(new Date(`${candidate.date}T12:00:00`))) : candidate.date.slice(0, 7)) === key) }];
  })).values()).sort((a, b) => b.key.localeCompare(a.key));
  const saveWeight = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const weightKg = measurementSystem === measurementSystems.imperial ? lbToKg(Number(weightInput)) : Number(weightInput);
    if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 500) return;
    const nextEntries = [...entries.filter((entry) => entry.date !== weightDate), { date: weightDate, weightKg }].sort((a, b) => a.date.localeCompare(b.date));
    onSave({ ...profile, weightKg, weightEntries: nextEntries });
  };
  const removeWeight = (entry: WeightEntry) => onSave({ ...profile, weightEntries: entries.filter((candidate) => candidate.date !== entry.date) });
  return (
    <main className="page">
      <header className="page-header"><span className="eyebrow">No judgement</span><h1>Your rhythm</h1><p>A lightweight view of patterns—not another dashboard to manage.</p></header>
      <div className="workspace-tabs" role="tablist" aria-label="Insights workspace">
        <button id="insights-overview-tab" type="button" role="tab" aria-selected={section === "overview"} aria-controls="insights-overview-panel" className={section === "overview" ? "active" : ""} onClick={() => setSection("overview")}>Overview</button>
        <button id="insights-nutrition-tab" type="button" role="tab" aria-selected={section === "nutrition"} aria-controls="insights-nutrition-panel" className={section === "nutrition" ? "active" : ""} onClick={() => setSection("nutrition")}>Nutrition</button>
        {isHabitFeatureEnabled(profile.enabledHabitFeatures, habitFeatures.fasting) && <button id="insights-fasting-tab" type="button" role="tab" aria-selected={section === "fasting"} aria-controls="insights-fasting-panel" className={section === "fasting" ? "active" : ""} onClick={() => setSection("fasting")}>Fasting <span>{completedFastingRecords.length}</span></button>}
        {weightTrackingEnabled && <button id="insights-weight-tab" type="button" role="tab" aria-selected={section === "weight"} aria-controls="insights-weight-panel" className={section === "weight" ? "active" : ""} onClick={() => setSection("weight")}>Weight <span>{entries.length}</span></button>}
      </div>
      {section === "overview" && <section id="insights-overview-panel" role="tabpanel" aria-labelledby="insights-overview-tab" className="workspace-panel">
      <div className="summary-strip">
        <div className="card"><span>Logged days</span><strong>{loggedDays.length}<small> / 7</small></strong><small>complete enough to compare</small></div>
        {!profile.hideCalories && <div className="card"><span>Daily average</span><strong>{Math.round(average).toLocaleString()}</strong><small>kcal on logged days</small></div>}
        <div className="card"><span>Protein average</span><strong>{Math.round(proteinAverage)} g</strong><small>target {profile.proteinTarget} g</small></div>
        {profile.hideCalories && <div className="card"><span>Fibre average</span><strong>{Math.round(loggedDays.length ? loggedDays.reduce((sum, day) => sum + day.total.fiber, 0) / loggedDays.length : 0)} g</strong><small>target {profile.fiberTarget} g</small></div>}
      </div>
      <section className="insight-card card"><span className="action-icon mint"><Sparkles /></span><div><strong>{loggedDays.length < 3 ? "Your pattern will appear here" : profile.hideCalories ? "Your nutrient rhythm is taking shape" : average > profile.calorieTarget * 1.08 ? "A little above your target" : average < profile.calorieTarget * 0.75 ? "Your logged average is low" : "You’re close to your target"}</strong><p>{loggedDays.length < 3 ? "Log a few complete days. Partial days are never treated as failure." : profile.hideCalories ? "Use the nutrition view to notice protein, fibre and meal patterns without energy numbers." : "Use the nutrition view as a guide. One unusual meal or day does not define progress."}</p></div></section>
      <div className="insights-grid">
        <section className="insights-panel card"><div className="section-heading compact"><div><span className="eyebrow">Consistency</span><h2>How the week looked</h2></div><span className="subtle">{Math.round(loggedDays.length / 7 * 100)}%</span></div><div className="week-activity">{days.map((day) => <div className="week-activity-day" key={day.key}><span className={day.total.calories || day.total.protein ? "logged" : ""} aria-label={`${day.label}: ${day.total.protein ? "logged" : "not logged"}`} /><small>{day.label}</small></div>)}</div><p className="panel-note">{targetDays ? `${targetDays} of ${loggedDays.length} logged days were close to your ${profile.hideCalories ? "protein" : "daily energy"} guide.` : "Keep logging complete days to make this comparison useful."}</p></section>
        <section className="insights-panel card"><div className="section-heading compact"><div><span className="eyebrow">Patterns</span><h2>What stands out</h2></div><Utensils size={18} /></div><div className="insight-list"><div><span>Most logged</span><strong>{mostLoggedMeal?.count ? mealLabels[mostLoggedMeal.type] : "—"}</strong></div><div><span>Meals per logged day</span><strong>{averageMeals ? averageMeals.toFixed(1) : "—"}</strong></div><div><span>Guide days</span><strong>{targetDays || "—"}</strong></div></div></section>
      </div>
      {(isHabitFeatureEnabled(profile.enabledHabitFeatures, habitFeatures.water) || isHabitFeatureEnabled(profile.enabledHabitFeatures, habitFeatures.fasting)) && <section className="insights-panel card habit-insights"><div className="section-heading compact"><div><span className="eyebrow">Optional rhythms</span><h2>Beyond food</h2></div><span className="subtle">last 7 days</span></div><div className="habit-insight-grid">{isHabitFeatureEnabled(profile.enabledHabitFeatures, habitFeatures.water) && <div><Droplets size={17} /><span>Water days</span><strong>{waterDays}<small> / 7</small></strong></div>}{isHabitFeatureEnabled(profile.enabledHabitFeatures, habitFeatures.fasting) && <div><Timer size={17} /><span>Fasts completed</span><strong>{completedFasts}</strong></div>}</div></section>}
      </section>}
      {section === "weight" && weightTrackingEnabled && <section id="insights-weight-panel" role="tabpanel" aria-labelledby="insights-weight-tab" className="weight-section workspace-panel">
        <div className="section-heading"><div><span className="eyebrow">Optional progress</span><h2 id="weight-heading">Weight history</h2></div><span className="subtle">{entries.length} {entries.length === 1 ? "entry" : "entries"}</span></div>
        <form className="weight-log card" onSubmit={saveWeight}>
          <div><span className="weight-log-label">Log a weigh-in</span><p>Use the same conditions when you can. Trends are more useful than any single day.</p></div>
          <div className="weight-log-fields"><label><span>Date</span><input type="date" value={weightDate} max={localDateKey()} onChange={(event) => setWeightDate(event.target.value)} /></label><label><span>Weight</span><div className="input-suffix"><NumericInput required inputMode="decimal" min={measurementSystem === measurementSystems.imperial ? 44 : 20} max={measurementSystem === measurementSystems.imperial ? 1102 : 500} step="0.1" value={weightInput} onChange={(event) => setWeightInput(event.target.value)} /><span>{weightUnitFor(profile)}</span></div></label><button className="primary-button" type="submit"><Plus size={17} />Save weight</button></div>
        </form>
        <div className="weight-controls" role="group" aria-label="Weight average period">
          {(Object.entries({ week: "This week", month: "This month", all: "All time" }) as [WeightPeriod, string][]).map(([period, label]) => <button key={period} type="button" className={weightPeriod === period ? "active" : ""} aria-pressed={weightPeriod === period} onClick={() => setWeightPeriod(period)}>{label}</button>)}
        </div>
        <div className="weight-summary-strip">
          <button className="weight-metric card" type="button" onClick={() => setWeightPeriod("week")}><span>Average</span><strong>{weightAverage ? formatWeight(weightAverage, profile) : "—"}</strong><small>{weightPeriod === "week" ? "this week" : weightPeriod === "month" ? "this month" : "all time"}</small></button>
          <button className="weight-metric card" type="button" onClick={() => setWeightPeriod("all")}><span>Change</span><strong className={weightChange < 0 ? "weight-down" : weightChange > 0 ? "weight-up" : ""}>{periodEntries.length > 1 ? `${weightChange > 0 ? "+" : ""}${(measurementSystem === measurementSystems.imperial ? kgToLb(weightChange) : weightChange).toFixed(1)} ${weightUnitFor(profile)}` : "—"}</strong><small>oldest to latest</small></button>
        </div>
        {groupedWeights.length > 0 ? <div className="weight-history">{groupedWeights.map((group) => {
          const groupAverage = group.entries.reduce((sum, entry) => sum + entry.weightKg, 0) / group.entries.length;
          const label = weightPeriod === "week" ? `Week of ${new Date(`${group.key}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : new Date(`${group.key}-01T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" });
          return <details className="weight-history-group" key={group.key}><summary><span><strong>{label}</strong><small>{group.entries.length} {group.entries.length === 1 ? "weigh-in" : "weigh-ins"}</small></span><b>{formatWeight(groupAverage, profile)}</b></summary><div className="weight-history-entries">{group.entries.map((entry) => <div className="weight-history-entry" key={entry.date}><span>{new Date(`${entry.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span><strong>{formatWeight(entry.weightKg, profile)}</strong><button type="button" className="icon-button subtle-button" onClick={() => removeWeight(entry)} aria-label={`Remove weight logged on ${entry.date}`}><Trash2 size={14} /></button></div>)}</div></details>;
        })}</div> : <div className="weight-empty card"><strong>Your weight history starts here.</strong><p>Log a weigh-in above to see daily entries and rolling averages.</p></div>}
      </section>}
      {section === "fasting" && isHabitFeatureEnabled(profile.enabledHabitFeatures, habitFeatures.fasting) && <section id="insights-fasting-panel" role="tabpanel" aria-labelledby="insights-fasting-tab" className="fasting-history-section workspace-panel">
        <div className="section-heading"><div><span className="eyebrow">Optional rhythm</span><h2 id="fasting-history-heading">Fasting history</h2></div><span className="subtle">{fastingGoal}-hour goal</span></div>
        <div className="summary-strip fasting-summary-strip">
          <div className="card"><span>Completed</span><strong>{completedFastingRecords.length}</strong><small>tracked windows</small></div>
          <div className="card"><span>Average fast</span><strong>{averageFast ? formatFastingDuration(Math.round(averageFast * 10) / 10) : "—"}</strong><small>across history</small></div>
          <div className="card"><span>Reached goal</span><strong>{goalFasts}<small> / {completedFastingRecords.length}</small></strong><small>{completedFastingRecords.length ? "completed windows" : "no completed windows yet"}</small></div>
        </div>
        {activeFasting && <section className="fasting-active-history card" aria-labelledby="fasting-active-heading"><span className="action-icon amber"><Timer /></span><div><span className="eyebrow">In progress</span><strong id="fasting-active-heading">Started {fastingDateTime(activeFasting.startedAt)}</strong><p>Your current window will appear in history after your next meal.</p></div></section>}
        {completedFastingRecords.length > 0 ? <div className="fasting-history-list" aria-label="Completed fasting windows">{completedFastingRecords.map((record) => {
          const duration = fastingWindowHours(record.startedAt, record.endedAt);
          const reachedGoal = duration >= fastingGoal;
          return <article className="fasting-history-row card" key={record.id}><div><strong>{fastingDateTime(record.startedAt)}</strong><small>Ended {fastingDateTime(record.endedAt)}</small></div><div className="fasting-history-duration"><strong>{formatFastingDuration(duration)}</strong><span className={reachedGoal ? "reached" : ""}>{reachedGoal ? "Goal reached" : `Goal: ${fastingGoal} h`}</span></div></article>;
        })}</div> : <div className="fasting-history-empty card"><span className="action-icon amber"><Timer /></span><div><strong>Your fasting history starts here.</strong><p>Once a fasting window ends, you’ll see its duration and whether it reached your goal.</p></div></div>}
        {longestFast > 0 && <p className="panel-note">Longest completed fast: {formatFastingDuration(longestFast)}. Tracking only, not a medical recommendation.</p>}
      </section>}
      {section === "nutrition" && <section id="insights-nutrition-panel" role="tabpanel" aria-labelledby="insights-nutrition-tab" className="workspace-panel">
      {!profile.hideCalories && <section className="chart-card card">
        <div className="section-heading compact"><div><span className="eyebrow">Last 7 days</span><h2>Calories</h2></div><span className="legend"><i /> {profile.calorieTarget.toLocaleString()} target</span></div>
        <div className="chart-area">
          <div className="target-line" style={{ bottom: `${(profile.calorieTarget / max) * 100}%` }} />
          {days.map((day) => <div className="chart-column" key={day.key}><div className="chart-bar-wrap"><div className="chart-bar" style={{ height: `${(day.total.calories / max) * 100}%` }}><span>{day.total.calories ? Math.round(day.total.calories) : ""}</span></div></div><small>{day.label}</small></div>)}
        </div>
      </section>}
      {profile.hideCalories && <section className="insight-card card"><span className="action-icon mint"><Sparkles /></span><div><strong>{loggedDays.length < 3 ? "Your pattern will appear here" : "Your nutrient rhythm is taking shape"}</strong><p>{loggedDays.length < 3 ? "Log a few complete days. Partial days are never treated as failure." : "Keep logging meals to notice protein, fibre and meal patterns over time."}</p></div></section>}
      {loggedDays.length > 0 && <div className="insights-grid nutrition-insights-grid"><section className="insights-panel card"><div className="section-heading compact"><div><span className="eyebrow">Logged-day average</span><h2>Macros</h2></div></div><div className="insight-macro-bars"><MacroBar label="Protein" value={averageNutrition.protein} target={profile.proteinTarget} color="var(--protein)" /><MacroBar label="Carbs" value={averageNutrition.carbs} target={profile.carbsTarget} color="var(--carbs)" /><MacroBar label="Fat" value={averageNutrition.fat} target={profile.fatTarget} color="var(--fat)" /><MacroBar label="Fibre" value={averageNutrition.fiber} target={profile.fiberTarget} color="var(--mint)" /></div></section><section className="insights-panel card"><div className="section-heading compact"><div><span className="eyebrow">Meal mix</span><h2>Where you log</h2></div></div><div className="meal-mix">{mealCounts.map(({ type, count }) => <div key={type}><div className="meal-mix-label"><span>{mealLabels[type]}</span><strong>{count}</strong></div><div className="bar-track"><div className="bar-fill" style={{ width: `${Math.min(100, count / Math.max(1, meals.length) * 100)}%`, background: "var(--mint)" }} /></div></div>)}</div></section></div>}
      </section>}
    </main>
  );
}


function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const progress = Math.min(100, (value / Math.max(1, target)) * 100);
  return (
    <div className="macro-row">
      <div className="macro-label"><span>{label}</span><strong>{round(value, 0)} <small>/ {target} g</small></strong></div>
      <div className="bar-track" role="progressbar" aria-label={`${label}: ${round(value, 0)} of ${target} grams`} aria-valuemin={0} aria-valuemax={target} aria-valuenow={round(value, 0)}><div className="bar-fill" style={{ width: `${progress}%`, background: color }} /></div>
    </div>
  );
}
