"use client";

import { Activity, Droplets, Filter, Flame, Pencil, Plus, Scale, Sparkles, Timer, Trash2, Utensils, Wheat } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { localDateKey, round, startOfWeek, sumNutrition } from "@/lib/nutrition";
import { hydrationDayTotals } from "@/lib/hydration";
import { activeFast, fastingWindowHours, formatFastingDuration, uniqueFastingRecords } from "@/lib/fasting";
import { isHabitFeatureEnabled } from "@/lib/habit-settings";
import { NumericInput } from "@/features/shared/NumericInput";
import { DatePickerField } from "@/features/shared/DatePicker";
import type { InsightsSection } from "@/features/navigation/types";
import type { FastingRecord, InsightsRange, Meal, MealType, Profile, WeightEntry } from "@/lib/types";
import { habitFeatures, measurementSystems } from "@/lib/types";
import { averageNutritionFor } from "./averageNutrition";

type WeightPeriod = "week" | "month" | "all";
type FastingPeriod = "week" | "month" | "all";

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
const fastingDateTimeInput = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

function validWeightEntries(entries: Profile["weightEntries"]): WeightEntry[] {
  return (Array.isArray(entries) ? entries : []).filter((entry): entry is WeightEntry => typeof entry?.date === "string" && Number.isFinite(entry.weightKg));
}

function validFastingRecords(records: Profile["fastingRecords"]): FastingRecord[] {
  return (Array.isArray(records) ? records : []).filter((record): record is FastingRecord => typeof record?.id === "string" && typeof record.startedAt === "string" && (record.endedAt === undefined || typeof record.endedAt === "string"));
}

export function InsightsView({ meals, profile, onSave, weightTrackingEnabled, initialSection }: { meals: Meal[]; profile: Profile; onSave: (profile: Profile) => void; weightTrackingEnabled: boolean; initialSection?: InsightsSection }) {
  const fastingEnabled = isHabitFeatureEnabled(profile.enabledHabitFeatures, habitFeatures.fasting);
  const [fastingPeriod, setFastingPeriod] = useState<FastingPeriod>("all");
  const [section, setSection] = useState<InsightsSection>(initialSection || "overview");
  const [range, setRange] = useState<InsightsRange>(profile.insightsDefaultRange ?? "week");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!filtersOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!filtersRef.current?.contains(event.target as Node)) setFiltersOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", closeOnEscape); };
  }, [filtersOpen]);
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
  const averageNutrition = averageNutritionFor(loggedDays.map((day) => day.total), profile.macroRoundingDigits ?? 1);
  const averageMeals = loggedDays.length ? meals.filter((meal) => days.some((day) => day.key === (meal.loggedDate || localDateKey(new Date(meal.createdAt))))).length / loggedDays.length : 0;
  const mealCounts = (Object.keys(mealLabels) as MealType[]).map((type) => ({ type, count: meals.filter((meal) => meal.mealType === type && days.some((day) => day.key === (meal.loggedDate || localDateKey(new Date(meal.createdAt))))).length }));
  const mostLoggedMeal = mealCounts.slice().sort((a, b) => b.count - a.count)[0];
  const tolerance = (profile.insightsTolerancePercent ?? 10) / 100;
  const calorieLow = profile.calorieTarget * (1 - tolerance);
  const calorieHigh = profile.calorieTarget * (1 + tolerance);
  const proteinLow = profile.proteinTarget * (1 - tolerance);
  const earliestMealDate = meals.reduce<string | undefined>((earliest, meal) => {
    const key = meal.loggedDate || localDateKey(new Date(meal.createdAt));
    return !earliest || key < earliest ? key : earliest;
  }, undefined);
  const rangeDayCount = range === "week" ? 7 : range === "month" ? 30 : earliestMealDate ? Math.min(365, Math.max(7, Math.round((new Date().getTime() - new Date(`${earliestMealDate}T12:00:00`).getTime()) / 86_400_000) + 1)) : 7;
  const rangeDays = range === "week" ? days : Array.from({ length: rangeDayCount }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (rangeDayCount - 1 - index));
    const key = localDateKey(date);
    const total = sumNutrition(meals.filter((meal) => (meal.loggedDate || localDateKey(new Date(meal.createdAt))) === key).map((meal) => meal.nutrition));
    return { key, total };
  });
  const rangeLoggedDays = rangeDays.filter((day) => day.total.calories > 0 || day.total.protein > 0);
  const targetDays = profile.hideCalories ? rangeLoggedDays.filter((day) => day.total.protein >= proteinLow).length : rangeLoggedDays.filter((day) => day.total.calories >= calorieLow && day.total.calories <= calorieHigh).length;
  const waterTarget = profile.waterTargetMl || 2000;
  const waterLoggedDays = hydrationDayTotals(profile.waterEntries);
  const waterDays = waterLoggedDays.filter((day) => day.amountMl >= waterTarget * .8).length;
  const MAX_PLAUSIBLE_FASTING_HOURS = 48;
  const fastingRecords = uniqueFastingRecords(validFastingRecords(profile.fastingRecords));
  const completedFasts = fastingRecords.filter((record) => record.endedAt && fastingWindowHours(record.startedAt, record.endedAt) >= (profile.fastingGoalHours || 16) && fastingWindowHours(record.startedAt, record.endedAt) <= MAX_PLAUSIBLE_FASTING_HOURS).length;
  const fastingGoal = profile.fastingGoalHours || 16;
  const activeFasting = activeFast(fastingRecords);
  const completedFastingRecords = fastingRecords
    .filter((record): record is FastingRecord & { endedAt: string } => Boolean(record.endedAt))
    .sort((a, b) => b.endedAt.localeCompare(a.endedAt));
  const fastingPeriodRecords = completedFastingRecords.filter((record) => {
    if (fastingPeriod === "all") return true;
    const now = new Date();
    const date = new Date(record.endedAt);
    if (fastingPeriod === "month") return date >= new Date(now.getFullYear(), now.getMonth(), 1);
    return date >= startOfWeek(localDateKey(now), profile.weekStartsOn);
  });
  const fastingDurations = fastingPeriodRecords.map((record) => fastingWindowHours(record.startedAt, record.endedAt));
  const plausibleFastingDurations = fastingDurations.filter((hours) => hours <= MAX_PLAUSIBLE_FASTING_HOURS);
  const averageFast = plausibleFastingDurations.length ? plausibleFastingDurations.reduce((sum, hours) => sum + hours, 0) / plausibleFastingDurations.length : 0;
  const longestFast = plausibleFastingDurations.length ? Math.max(...plausibleFastingDurations) : 0;
  const [weightPeriod, setWeightPeriod] = useState<WeightPeriod>("all");
  const activeSection: InsightsSection = (section === "weight" && !weightTrackingEnabled) || (section === "fasting" && !fastingEnabled) ? "overview" : section;
  const [editingFastingId, setEditingFastingId] = useState<string>();
  const [fastingDraft, setFastingDraft] = useState<{ startedAt: string; endedAt: string }>({ startedAt: "", endedAt: "" });
  const entries = validWeightEntries(profile.weightEntries).sort((a, b) => b.date.localeCompare(a.date));
  const latestWeight = entries[0]?.weightKg ?? profile.weightKg;
  const measurementSystem = measurementSystemFor(profile);
  const [weightDate, setWeightDate] = useState(localDateKey());
  const [weightInput, setWeightInput] = useState(entries.length ? String(measurementSystem === measurementSystems.imperial ? Math.round(kgToLb(latestWeight) * 10) / 10 : latestWeight) : "");
  let streakDays = 0;
  for (const day of [...days].reverse()) {
    if (day.total.calories <= 0 && day.total.protein <= 0) break;
    streakDays += 1;
  }
  const periodEntries = entries.filter((entry) => {
    if (weightPeriod === "all") return true;
    const now = new Date();
    const entryDate = new Date(`${entry.date}T12:00:00`);
    if (weightPeriod === "month") return entryDate >= new Date(now.getFullYear(), now.getMonth(), 1);
    return entryDate >= startOfWeek(localDateKey(now), profile.weekStartsOn);
  });
  const weightAverage = periodEntries.length ? periodEntries.reduce((sum, entry) => sum + entry.weightKg, 0) / periodEntries.length : 0;
  const weightChange = periodEntries.length > 1 ? periodEntries[0].weightKg - periodEntries[periodEntries.length - 1].weightKg : 0;
  const groupedWeights = Array.from(periodEntries.reduce((groups, entry) => {
    const key = weightPeriod === "week" ? localDateKey(startOfWeek(entry.date, profile.weekStartsOn)) : entry.date.slice(0, 7);
    const group = groups.get(key);
    if (group) group.entries.push(entry);
    else groups.set(key, { key, entries: [entry] });
    return groups;
  }, new Map<string, { key: string; entries: WeightEntry[] }>()).values()).sort((a, b) => b.key.localeCompare(a.key));
  const saveWeight = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const weightKg = measurementSystem === measurementSystems.imperial ? lbToKg(Number(weightInput)) : Number(weightInput);
    if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 500) return;
    const nextEntries = [...entries.filter((entry) => entry.date !== weightDate), { date: weightDate, weightKg }].sort((a, b) => a.date.localeCompare(b.date));
    onSave({ ...profile, weightKg, weightEntries: nextEntries });
  };
  const removeWeight = (entry: WeightEntry) => onSave({ ...profile, weightEntries: entries.filter((candidate) => candidate.date !== entry.date) });
  const beginFastingEdit = (record: FastingRecord) => { setEditingFastingId(record.id); setFastingDraft({ startedAt: fastingDateTimeInput(record.startedAt), endedAt: fastingDateTimeInput(record.endedAt) }); };
  const saveFastingEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingFastingId || !fastingDraft.startedAt) return;
    const startedAt = new Date(fastingDraft.startedAt);
    const endedAt = fastingDraft.endedAt ? new Date(fastingDraft.endedAt) : undefined;
    if (Number.isNaN(startedAt.getTime()) || (endedAt && Number.isNaN(endedAt.getTime())) || (endedAt && endedAt <= startedAt)) return;
    onSave({ ...profile, fastingRecordEdits: { ...profile.fastingRecordEdits, [editingFastingId]: { startedAt: startedAt.toISOString(), ...(endedAt ? { endedAt: endedAt.toISOString() } : {}) } } });
    setEditingFastingId(undefined);
  };
  const hasFilters = activeSection === "overview" || activeSection === "nutrition" || activeSection === "weight" || activeSection === "fasting";
  const tabsBar = (
    <div className="workspace-tabs" role="tablist" aria-label="Insights workspace">
      <button id="insights-overview-tab" type="button" role="tab" aria-selected={activeSection === "overview"} aria-controls="insights-overview-panel" aria-label="Overview" className={activeSection === "overview" ? "active" : ""} onClick={() => setSection("overview")}><Activity size={15} /><span>Overview</span></button>
      <button id="insights-nutrition-tab" type="button" role="tab" aria-selected={activeSection === "nutrition"} aria-controls="insights-nutrition-panel" aria-label="Nutrition" className={activeSection === "nutrition" ? "active" : ""} onClick={() => setSection("nutrition")}><Wheat size={15} /><span>Nutrition</span></button>
      {weightTrackingEnabled && <button id="insights-weight-tab" type="button" role="tab" aria-selected={activeSection === "weight"} aria-controls="insights-weight-panel" aria-label="Weight" className={activeSection === "weight" ? "active" : ""} onClick={() => setSection("weight")}><Scale size={15} /><span>Weight</span></button>}
      {fastingEnabled && <button id="insights-fasting-tab" type="button" role="tab" aria-selected={activeSection === "fasting"} aria-controls="insights-fasting-panel" aria-label="Fasting" className={activeSection === "fasting" ? "active" : ""} onClick={() => setSection("fasting")}><Timer size={15} /><span>Fasting</span></button>}
    </div>
  );
  const rangeChips = (
    <div className="insights-ranges" role="group" aria-label="Insights range">{([{ key: "week", label: "7 days" }, { key: "month", label: "30 days" }, { key: "all", label: "All time" }] as const).map((item) => <button key={item.key} type="button" className={range === item.key ? "active" : ""} onClick={() => { setRange(item.key); onSave({ ...profile, insightsDefaultRange: item.key }); }}>{item.label}</button>)}</div>
  );
  const toleranceChips = (
    <div className="insights-ranges" role="group" aria-label="On-track sensitivity">{([5, 10, 20] as const).map((percent) => <button key={percent} type="button" className={(profile.insightsTolerancePercent ?? 10) === percent ? "active" : ""} onClick={() => onSave({ ...profile, insightsTolerancePercent: percent })}>±{percent}%</button>)}</div>
  );
  const weightPeriodChips = (
    <div className="weight-controls" role="group" aria-label="Weight average period">
      {(Object.entries({ week: "This week", month: "This month", all: "All time" }) as [WeightPeriod, string][]).map(([period, label]) => <button key={period} type="button" className={weightPeriod === period ? "active" : ""} aria-pressed={weightPeriod === period} onClick={() => setWeightPeriod(period)}>{label}</button>)}
    </div>
  );
  const fastingPeriodChips = (
    <div className="fasting-controls weight-controls" role="group" aria-label="Fasting history period">
      {(["week", "month", "all"] as const).map((period) => <button key={period} type="button" className={fastingPeriod === period ? "active" : ""} aria-pressed={fastingPeriod === period} onClick={() => setFastingPeriod(period)}>{period === "week" ? "This week" : period === "month" ? "This month" : "All time"}</button>)}
    </div>
  );
  return (
    <main className="page insights-page">
      <header className="insights-handoff-header"><span>Insights</span><h1>{activeSection === "overview" ? "How it’s going" : activeSection === "nutrition" ? "Nutrition" : activeSection === "weight" ? "Weight" : "Fasting"}</h1></header>
      {hasFilters ? <div className="workspace-tabs-row">
        {tabsBar}
        <div className="workspace-filters" ref={filtersRef}>
          <button type="button" className="workspace-filters-trigger" aria-haspopup="true" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}><Filter size={14} />Filters</button>
          {filtersOpen && <div className="workspace-filters-popover">
            {(activeSection === "overview" || activeSection === "nutrition") && <><span className="workspace-filters-label">Range</span>{rangeChips}</>}
            {activeSection === "overview" && <><span className="workspace-filters-label">Sensitivity</span>{toleranceChips}</>}
            {activeSection === "weight" && <><span className="workspace-filters-label">Average period</span>{weightPeriodChips}</>}
            {activeSection === "fasting" && <><span className="workspace-filters-label">History period</span>{fastingPeriodChips}</>}
          </div>}
        </div>
      </div> : tabsBar}
      <div className="insights-ranges-inline">
        {(activeSection === "overview" || activeSection === "nutrition") && rangeChips}
        {activeSection === "overview" && toleranceChips}
      </div>
      {activeSection === "overview" && <section id="insights-overview-panel" role="tabpanel" aria-labelledby="insights-overview-tab" className="workspace-panel">
      <div className="insights-stat-grid"><div className="card"><span>Logging streak</span><strong><Flame />{streakDays}<small> days</small></strong></div><div className="card"><span>Days logged</span><strong>{rangeLoggedDays.length}<small> of {rangeDayCount}</small></strong></div></div>
      {!profile.hideCalories && <section className="chart-card card insights-calorie-chart"><div className="section-heading compact"><div><span className="eyebrow">Calories by day</span></div><span className="subtle">avg <strong>{Math.round(average).toLocaleString()}</strong></span></div><div className="chart-area"><div className="target-line" style={{ bottom: `${(profile.calorieTarget / max) * 100}%` }} />{days.map((day) => <div className="chart-column" key={day.key}><div className="chart-bar-wrap"><div className={`chart-bar${day.total.calories > profile.calorieTarget ? " over" : ""}`} style={{ height: `${(day.total.calories / max) * 100}%` }}><span>{day.total.calories ? Math.round(day.total.calories) : ""}</span></div></div><small>{day.label}</small></div>)}</div><div className="insights-chart-legend"><span><i />Within target</span><span><i />Over target</span></div></section>}
      <section className="insight-card card"><span className="action-icon mint"><Sparkles /></span><div><strong>{loggedDays.length < 3 ? "Your pattern will appear here" : profile.hideCalories ? "Your nutrient rhythm is taking shape" : average > calorieHigh ? "A little above your target" : average < calorieLow ? "Your logged average is low" : "You’re close to your target"}</strong><p>{loggedDays.length < 3 ? "Log a few complete days. Partial days are never treated as failure." : profile.hideCalories ? "Use the nutrition view to notice protein, fibre and meal patterns without energy numbers." : "Use the nutrition view as a guide. One unusual meal or day does not define progress."}</p></div></section>
      <div className="insights-grid">
        <section className="insights-panel card"><div className="section-heading compact"><div><span className="eyebrow">Consistency</span><h2>How the week looked</h2></div><span className="subtle">{Math.round(loggedDays.length / 7 * 100)}%</span></div><div className="week-activity">{days.map((day) => <div className="week-activity-day" key={day.key}><span className={day.total.calories || day.total.protein ? "logged" : ""} aria-label={`${day.label}: ${day.total.protein ? "logged" : "not logged"}`} /><small>{day.label}</small></div>)}</div><p className="panel-note">{targetDays ? `${targetDays} of ${rangeLoggedDays.length} logged days were close to your ${profile.hideCalories ? "protein" : "daily energy"} guide.` : "Keep logging complete days to make this comparison useful."}</p></section>
        <section className="insights-panel card"><div className="section-heading compact"><div><span className="eyebrow">Patterns</span><h2>What stands out</h2></div><Utensils size={18} /></div><div className="insight-list"><div><span>Most logged</span><strong>{mostLoggedMeal?.count ? mealLabels[mostLoggedMeal.type] : "—"}</strong></div><div><span>Meals per logged day</span><strong>{averageMeals ? averageMeals.toFixed(1) : "—"}</strong></div><div><span>Guide days</span><strong>{targetDays || "—"}</strong></div></div></section>
      </div>
      {(isHabitFeatureEnabled(profile.enabledHabitFeatures, habitFeatures.water) || isHabitFeatureEnabled(profile.enabledHabitFeatures, habitFeatures.fasting)) && <section className="insights-panel card habit-insights"><div className="section-heading compact"><div><span className="eyebrow">Optional rhythms</span><h2>Beyond food</h2></div><span className="subtle">all time</span></div><div className="habit-insight-grid">{isHabitFeatureEnabled(profile.enabledHabitFeatures, habitFeatures.water) && <div><Droplets size={17} /><span>Water days</span><strong>{waterDays}<small> / {waterLoggedDays.length} days</small></strong></div>}{isHabitFeatureEnabled(profile.enabledHabitFeatures, habitFeatures.fasting) && <div><Timer size={17} /><span>Fasts completed</span><strong>{completedFasts}</strong></div>}</div></section>}
      </section>}
      {activeSection === "weight" && weightTrackingEnabled && <section id="insights-weight-panel" role="tabpanel" aria-labelledby="insights-weight-tab" className="weight-section workspace-panel">
        <div className="section-heading"><div><span className="eyebrow">Optional progress</span><h2 id="weight-heading">Weight history</h2></div><span className="subtle">{entries.length} {entries.length === 1 ? "entry" : "entries"}</span></div>
        <form className="weight-log card" onSubmit={saveWeight}>
          <div><span className="weight-log-label">Log a weigh-in</span><p>Use the same conditions when you can. Trends are more useful than any single day.</p></div>
          <div className="weight-log-fields"><DatePickerField label="Date" value={weightDate} max={localDateKey()} onChange={(value) => setWeightDate(value || localDateKey())} /><label><span>Weight</span><div className="input-suffix"><NumericInput required inputMode="decimal" min={measurementSystem === measurementSystems.imperial ? 44 : 20} max={measurementSystem === measurementSystems.imperial ? 1102 : 500} step="0.1" value={weightInput} onChange={(event) => setWeightInput(event.target.value)} /><span>{weightUnitFor(profile)}</span></div></label><button className="primary-button" type="submit"><Plus size={17} />Save weight</button></div>
        </form>
        <div className="insights-controls-inline">{weightPeriodChips}</div>
        <div className="weight-summary-strip"><div className="weight-metric card"><span>Latest</span><strong>{entries.length ? formatWeight(latestWeight, profile) : "—"}</strong></div><div className="weight-metric card"><span>Change</span><strong className={weightChange < 0 ? "weight-down" : weightChange > 0 ? "weight-up" : ""}>{periodEntries.length > 1 ? `${weightChange > 0 ? "+" : ""}${(measurementSystem === measurementSystems.imperial ? kgToLb(weightChange) : weightChange).toFixed(1)} ${weightUnitFor(profile)}` : "—"}</strong></div><div className="weight-metric card"><span>Average</span><strong>{weightAverage ? formatWeight(weightAverage, profile) : "—"}</strong></div></div>
        {groupedWeights.length > 0 ? <div className="weight-history">{groupedWeights.map((group) => {
          const groupAverage = group.entries.reduce((sum, entry) => sum + entry.weightKg, 0) / group.entries.length;
          const label = weightPeriod === "week" ? `Week of ${new Date(`${group.key}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : new Date(`${group.key}-01T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" });
          return <details className="weight-history-group" key={group.key}><summary><span><strong>{label}</strong><small>{group.entries.length} {group.entries.length === 1 ? "weigh-in" : "weigh-ins"}</small></span><span className="weight-group-average"><small>{weightPeriod === "week" ? "Weekly average" : "Monthly average"}</small><b>{formatWeight(groupAverage, profile)}</b></span></summary><div className="weight-history-entries">{group.entries.map((entry) => <div className="weight-history-entry" key={entry.date}><span>{new Date(`${entry.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span><strong>{formatWeight(entry.weightKg, profile)}</strong><button type="button" className="icon-button subtle-button" onClick={() => removeWeight(entry)} aria-label={`Remove weight logged on ${entry.date}`}><Trash2 size={14} /></button></div>)}</div></details>;
        })}</div> : <div className="weight-empty card"><strong>Your weight history starts here.</strong><p>Log a weigh-in above to see daily entries and rolling averages.</p></div>}
      </section>}
      {activeSection === "fasting" && fastingEnabled && <section id="insights-fasting-panel" role="tabpanel" aria-labelledby="insights-fasting-tab" className="fasting-history-section workspace-panel">
        <div className="section-heading"><div><span className="eyebrow">Optional rhythm</span><h2 id="fasting-history-heading">Fasting history</h2></div><span className="subtle">{fastingPeriodRecords.length} {fastingPeriodRecords.length === 1 ? "fast" : "fasts"}</span></div>
        <div className="insights-controls-inline">{fastingPeriodChips}</div>
        <div className="summary-strip fasting-summary-strip"><div className="card"><span>Completed</span><strong>{fastingPeriodRecords.length}</strong><small> windows</small></div><div className="card"><span>Average fast</span><strong>{averageFast ? averageFast.toFixed(1) : "—"}<small> h</small></strong></div><div className="card"><span>Longest</span><strong>{longestFast ? longestFast.toFixed(1) : "—"}<small> h</small></strong></div></div>
        {activeFasting && <section className="fasting-active-history card" aria-labelledby="fasting-active-heading"><span className="action-icon amber"><Timer /></span><div><span className="eyebrow">In progress</span><strong id="fasting-active-heading">Started {fastingDateTime(activeFasting.startedAt)}</strong><p>Your current window will appear in history after your next meal.</p></div></section>}
        {fastingPeriodRecords.length > 0 ? <div className="fasting-history-list" aria-label="Completed fasting windows">{fastingPeriodRecords.map((record) => {
          const duration = fastingWindowHours(record.startedAt, record.endedAt);
          const reachedGoal = duration >= fastingGoal;
          const implausible = duration > MAX_PLAUSIBLE_FASTING_HOURS;
          return <div key={record.id}><article className="fasting-history-row card"><div><strong>{fastingDateTime(record.startedAt)}</strong><small>Ended {fastingDateTime(record.endedAt)}</small></div><div className="fasting-history-duration"><strong>{formatFastingDuration(duration)}</strong><span className={reachedGoal ? "reached" : ""}>{implausible ? "Not counted — likely a missed log" : reachedGoal ? "Goal reached" : `Goal: ${fastingGoal} h`}</span></div><button type="button" className="icon-button subtle-button" onClick={() => beginFastingEdit(record)} aria-label="Edit fasting window"><Pencil size={14} /></button></article>{editingFastingId === record.id && <form className="fasting-edit-form card" onSubmit={saveFastingEdit}><div><label><span>Fast started</span><input type="datetime-local" required value={fastingDraft.startedAt} onChange={(event) => setFastingDraft((current) => ({ ...current, startedAt: event.target.value }))} /></label><label><span>Fast ended</span><input type="datetime-local" value={fastingDraft.endedAt} onChange={(event) => setFastingDraft((current) => ({ ...current, endedAt: event.target.value }))} /></label></div><div className="sheet-actions"><button type="button" className="secondary-button" onClick={() => setEditingFastingId(undefined)}>Cancel</button><button type="submit" className="primary-button">Save times</button></div></form>}</div>;
        })}</div> : <div className="fasting-history-empty card"><span className="action-icon amber"><Timer /></span><div><strong>Your fasting history starts here.</strong><p>Once a fasting window ends, you’ll see its duration and whether it reached your goal.</p></div></div>}
        {longestFast > 0 && <p className="panel-note">Longest completed fast: {formatFastingDuration(longestFast)}. Tracking only, not a medical recommendation.</p>}
      </section>}
      {activeSection === "nutrition" && <section id="insights-nutrition-panel" role="tabpanel" aria-labelledby="insights-nutrition-tab" className="workspace-panel">
      {!profile.hideCalories && <section className="chart-card card">
        <div className="section-heading compact"><div><span className="eyebrow">Last 7 days</span><h2>Calories</h2></div><span className="legend"><i /> {profile.calorieTarget.toLocaleString()} target</span></div>
        <div className="chart-area">
          <div className="target-line" style={{ bottom: `${(profile.calorieTarget / max) * 100}%` }} />
          {days.map((day) => <div className="chart-column" key={day.key}><div className="chart-bar-wrap"><div className="chart-bar" style={{ height: `${(day.total.calories / max) * 100}%` }}><span>{day.total.calories ? Math.round(day.total.calories) : ""}</span></div></div><small>{day.label}</small></div>)}
        </div>
      </section>}
      {profile.hideCalories && <section className="insight-card card"><span className="action-icon mint"><Sparkles /></span><div><strong>{loggedDays.length < 3 ? "Your pattern will appear here" : "Your nutrient rhythm is taking shape"}</strong><p>{loggedDays.length < 3 ? "Log a few complete days. Partial days are never treated as failure." : "Keep logging meals to notice protein, fibre and meal patterns over time."}</p></div></section>}
      {loggedDays.length > 0 && <div className="insights-grid nutrition-insights-grid"><section className="insights-panel card"><div className="section-heading compact"><div><span className="eyebrow">Average per logged day</span><h2>Macros</h2></div></div><p className="panel-note macro-average-note">Only days with logged food are included. Each value is compared with your daily target.</p><div className="insight-macro-bars"><MacroBar label="Protein" value={averageNutrition.protein} target={profile.proteinTarget} color="var(--protein)" /><MacroBar label="Carbs" value={averageNutrition.carbs} target={profile.carbsTarget} color="var(--carbs)" /><MacroBar label="Fat" value={averageNutrition.fat} target={profile.fatTarget} color="var(--fat)" /><MacroBar label="Fibre" value={averageNutrition.fiber} target={profile.fiberTarget} color="var(--mint)" /></div></section><section className="insights-panel card"><div className="section-heading compact"><div><span className="eyebrow">Meal mix</span><h2>Where you log</h2></div></div><div className="meal-mix">{mealCounts.map(({ type, count }) => <div key={type}><div className="meal-mix-label"><span>{mealLabels[type]}</span><strong>{count}</strong></div><div className="bar-track"><div className="bar-fill" style={{ width: `${Math.min(100, count / Math.max(1, meals.length) * 100)}%`, background: "var(--mint)" }} /></div></div>)}</div></section></div>}
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
