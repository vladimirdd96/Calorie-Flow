"use client";
/* eslint-disable @next/next/no-img-element -- remote product thumbnails and local camera previews are dynamic user content. */

import {
  ArrowLeft,
  BarChart3,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Cloud,
  Home,
  Info,
  LogOut,
  LockKeyhole,
  Mail,
  MessageCircle,
  Package,
  Pencil,
  Plus,
  ScanLine,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  Utensils,
  WifiOff,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  exportData,
  getAll,
  getLocalSnapshot,
  getSetting,
  importData,
  initializeFoods,
  put,
  remove,
  replaceLocalSnapshot,
  resetToGuestData,
  setSetting,
} from "@/lib/db";
import {
  clearCloudCoachMessages,
  deleteCloudMeal,
  getCloudCoachMessages,
  getCloudSnapshot,
  mergeSnapshots,
  pushCloudSnapshot,
  saveCloudCoachMessage,
  upsertCloudFood,
  upsertCloudMeal,
  upsertCloudProfile,
} from "@/lib/cloud";
import { useAuth } from "@/hooks/useAuth";
import {
  calculateCalories,
  calculateMacroTargets,
  contextualUnits,
  formatUnit,
  gramsFor,
  localDateKey,
  round,
  scaleNutrition,
  sumNutrition,
} from "@/lib/nutrition";
import { findByBarcode, searchOpenFoodFacts } from "@/lib/openfoodfacts";
import { getSupabase, type CloudUser, type SocialAuthProvider } from "@/lib/supabase";
import type {
  ActivityLevel,
  CoachMessage,
  DietPreset,
  Food,
  GoalMode,
  LabelAnalysis,
  Meal,
  MealType,
  Nutrition,
  Profile,
  ServingUnit,
  Sex,
} from "@/lib/types";

type Tab = "today" | "search" | "coach" | "insights" | "profile";
type AddView = "start" | "search" | "scan" | "label" | "manual";
type SyncState = "local" | "syncing" | "synced" | "offline" | "error";
type AuthMode = "sign-in" | "register" | "forgot-password" | "update-password";


const DEFAULT_PROFILE: Profile = {
  name: "",
  sex: "male",
  age: 30,
  heightCm: 180,
  weightKg: 80,
  activity: "moderate",
  goalMode: "maintain",
  dietPreset: "balanced",
  calorieTarget: 2750,
  proteinTarget: 145,
  carbsTarget: 375,
  fatTarget: 70,
  fiberTarget: 30,
  hideCalories: false,
  onboardingDone: false,
};

const mealLabels: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

const unitLabels: Record<ServingUnit, string> = {
  serving: "Serving",
  g: "Grams",
  "100g": "100 g",
  package: "Package",
  piece: "Piece",
  tbsp: "Tbsp",
  tsp: "Tsp",
  ml: "ml",
};

const dietMeta: Record<DietPreset, { label: string; description: string }> = {
  balanced: { label: "Balanced", description: "Flexible everyday split" },
  "high-protein": { label: "High protein", description: "More protein, flexible carbs" },
  keto: { label: "Keto", description: "25 g carbs, higher fat" },
  "high-protein-keto": { label: "Protein keto", description: "30 g carbs, more protein" },
  "low-fat": { label: "Low fat", description: "20% calories from fat" },
};

function getMealType(): MealType {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 20) return "dinner";
  return "snack";
}

function dayLabel(dateKey: string) {
  const today = localDateKey();
  if (dateKey === today) return "Today";
  const date = new Date(`${dateKey}T12:00:00`);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateKey === localDateKey(yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function changeDate(dateKey: string, amount: number) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return localDateKey(date);
}

function GoogleIcon() {
  return (
    <svg className="provider-mark google" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M21.35 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.92a5.05 5.05 0 0 1-2.18 3.31v2.78h3.57c2.08-1.92 3.28-4.74 3.28-8.12Z" />
      <path fill="#34A853" d="M12 21.72c2.64 0 4.85-.87 6.47-2.36l-3.57-2.78c-.99.66-2.26 1.06-3.65 1.06-2.81 0-5.19-1.9-6.04-4.45H4.53v2.87A9.77 9.77 0 0 0 12 21.72Z" />
      <path fill="#FBBC05" d="M5.96 13.22A5.87 5.87 0 0 1 5.63 12c0-.42.07-.82.2-1.21V7.92H2.15A9.77 9.77 0 0 0 2.15 16l3.81-2.78Z" />
      <path fill="#EA4335" d="M12 6.33c1.52 0 2.89.52 3.97 1.55l2.98-2.98C16.84 2.93 14.64 2 12 2a9.77 9.77 0 0 0-7.47 3.64l3.3 2.57c.85-2.01 3.23-3.45 6.04-3.45Z" />
    </svg>
  );
}

function ProgressRing({ value, target }: { value: number; target: number }) {
  const progress = Math.min(1, value / Math.max(1, target));
  const circumference = 2 * Math.PI * 82;
  return (
    <div className="progress-ring" aria-label={`${Math.round(progress * 100)} percent of daily calories`}>
      <svg viewBox="0 0 200 200" role="img">
        <defs>
          <linearGradient id="progress-gradient" x1="20" y1="20" x2="180" y2="180">
            <stop offset="0" stopColor="#7dffd5" />
            <stop offset="0.58" stopColor="#33d6c3" />
            <stop offset="1" stopColor="#1a8dff" />
          </linearGradient>
        </defs>
        <circle className="ring-track" cx="100" cy="100" r="82" />
        <circle
          className="ring-value"
          cx="100"
          cy="100"
          r="82"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
        />
      </svg>
      <div className="ring-content">
        <span className="eyebrow">Eaten</span>
        <strong>{Math.round(value).toLocaleString()}</strong>
        <span>of {target.toLocaleString()} kcal</span>
      </div>
    </div>
  );
}

function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const progress = Math.min(100, (value / Math.max(1, target)) * 100);
  return (
    <div className="macro-row">
      <div className="macro-label"><span>{label}</span><strong>{round(value, 0)} <small>/ {target} g</small></strong></div>
      <div className="bar-track"><div className="bar-fill" style={{ width: `${progress}%`, background: color }} /></div>
    </div>
  );
}

function FoodAvatar({ food, name }: { food?: Food; name?: string }) {
  if (food?.imageUrl) return <img className="food-avatar" src={food.imageUrl} alt="" />;
  return <div className="food-avatar fallback">{(name || food?.name || "F").slice(0, 1).toUpperCase()}</div>;
}

function MealRow({ meal, onDelete, hideCalories }: { meal: Meal; onDelete: () => void; hideCalories: boolean }) {
  return (
    <div className="meal-row">
      <div className="meal-icon"><Utensils size={17} /></div>
      <div className="meal-copy">
        <strong>{meal.name}</strong>
        <span>{meal.amount} {formatUnit(meal.unit, meal.amount)} · P {meal.nutrition.protein} · C {meal.nutrition.carbs} · F {meal.nutrition.fat}</span>
      </div>
      {!hideCalories && <strong className="meal-kcal">{Math.round(meal.nutrition.calories)}</strong>}
      <button className="icon-button ghost danger-hover" onClick={onDelete} aria-label={`Delete ${meal.name}`}><Trash2 size={17} /></button>
    </div>
  );
}

function EmptyMeals({ onAdd }: { onAdd: () => void }) {
  return (
    <button className="empty-meals" onClick={onAdd}>
      <span className="empty-icon"><Plus size={20} /></span>
      <span><strong>Log your first food</strong><small>It takes a few seconds.</small></span>
      <ChevronRight size={18} />
    </button>
  );
}

function TodayView({
  profile,
  meals,
  dateKey,
  onDateChange,
  onAdd,
  onOpenCoach,
  onDelete,
  syncLabel,
}: {
  profile: Profile;
  meals: Meal[];
  dateKey: string;
  onDateChange: (date: string) => void;
  onAdd: () => void;
  onOpenCoach: () => void;
  onDelete: (id: string) => void;
  syncLabel: string;
}) {
  const total = useMemo(() => sumNutrition(meals.map((meal) => meal.nutrition)), [meals]);
  const remaining = Math.max(0, profile.calorieTarget - total.calories);
  const grouped = (Object.keys(mealLabels) as MealType[]).map((type) => ({ type, meals: meals.filter((meal) => meal.mealType === type) }));
  return (
    <main className="page today-page">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">C</span><div><strong>Calorie Flow</strong><small>Simple by default</small></div></div>
        <div className="status-pill"><ShieldCheck size={14} /> {syncLabel}</div>
      </header>

      <div className="date-switcher">
        <button className="icon-button ghost" onClick={() => onDateChange(changeDate(dateKey, -1))} aria-label="Previous day"><ChevronLeft /></button>
        <button onClick={() => onDateChange(localDateKey())}><strong>{dayLabel(dateKey)}</strong><span>{new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric" })}</span></button>
        <button className="icon-button ghost" disabled={dateKey >= localDateKey()} onClick={() => onDateChange(changeDate(dateKey, 1))} aria-label="Next day"><ChevronRight /></button>
      </div>

      <section className="hero-grid">
        <div className="hero-card card">
          {profile.hideCalories ? <div className="nutrition-focus"><span className="eyebrow">Today’s nutrients</span><strong>Focus on your macros</strong><p>Protein, carbs, fat and fibre stay visible. Energy numbers are hidden.</p></div> : <ProgressRing value={total.calories} target={profile.calorieTarget} />}
          <div className="hero-stat-grid">
            {!profile.hideCalories && <div><span>Remaining</span><strong>{Math.round(remaining).toLocaleString()}</strong><small>kcal</small></div>}
            <div><span>Fibre</span><strong>{round(total.fiber, 0)}</strong><small>/ {profile.fiberTarget} g</small></div>
          </div>
        </div>
        <div className="macro-card card">
          <div className="section-heading compact"><div><span className="eyebrow">Today</span><h2>Macros</h2></div><span className="subtle">live totals</span></div>
          <MacroBar label="Protein" value={total.protein} target={profile.proteinTarget} color="#7dffd5" />
          <MacroBar label="Carbs" value={total.carbs} target={profile.carbsTarget} color="#4fb7ff" />
          <MacroBar label="Fat" value={total.fat} target={profile.fatTarget} color="#ffb86b" />
          <div className="target-note"><Info size={15} /> Targets are guides, not exact medical limits.</div>
        </div>
      </section>

      <button className="coach-check-in" onClick={onOpenCoach}>
        <span className="action-icon mint"><MessageCircle size={19} /></span>
        <span><strong>Ask Coach about today</strong><small>Get guidance with your diary in context</small></span>
        <ChevronRight size={18} />
      </button>

      <section className="log-section">
        <div className="section-heading"><div><span className="eyebrow">Daily log</span><h2>Your meals</h2></div><button className="text-button" onClick={onAdd}><Plus size={17} /> Add food</button></div>
        {meals.length === 0 ? <EmptyMeals onAdd={onAdd} /> : grouped.map(({ type, meals: groupMeals }) => groupMeals.length > 0 && (
          <div className="meal-group" key={type}>
            <div className="meal-group-title"><span>{mealLabels[type]}</span>{!profile.hideCalories && <span>{Math.round(sumNutrition(groupMeals.map((meal) => meal.nutrition)).calories)} kcal</span>}</div>
            <div className="meal-list card">{groupMeals.map((meal) => <MealRow key={meal.id} meal={meal} hideCalories={profile.hideCalories} onDelete={() => onDelete(meal.id)} />)}</div>
          </div>
        ))}
      </section>
    </main>
  );
}

function FoodRow({ food, onSelect, hideCalories = false }: { food: Food; onSelect: () => void; hideCalories?: boolean }) {
  const detail = food.brand || (food.source === "custom" ? "Your custom food" : food.source === "seed" ? food.servingLabel || "Reference food" : "Saved food");
  return (
    <button className="food-row" onClick={onSelect}>
      <FoodAvatar food={food} />
      <span className="food-copy"><strong>{food.name}</strong><small>{detail}</small></span>
      {!hideCalories && <span className="food-calories"><strong>{Math.round(food.nutrientsPer100.calories)}</strong><small>kcal / 100 g</small></span>}
      <ChevronRight size={18} />
    </button>
  );
}

function DiscoverView({ foods, onSelect, onAdd, hideCalories }: { foods: Food[]; onSelect: (food: Food) => void; onAdd: (view: AddView) => void; hideCalories: boolean }) {
  const recent = [...foods].filter((food) => food.lastUsedAt).sort((a, b) => (b.lastUsedAt || "").localeCompare(a.lastUsedAt || "")).slice(0, 8);
  const personalFoods = [...foods]
    .filter((food) => food.source !== "seed")
    .sort((a, b) => (b.lastUsedAt || "").localeCompare(a.lastUsedAt || ""))
    .slice(0, 8);
  const starterFoods = foods.filter((food) => food.source === "seed").slice(0, 6);
  return (
    <main className="page">
      <header className="page-header"><span className="eyebrow">Your food shelf</span><h1>Log what you remember.</h1><p>Your own foods and recent meals stay at hand, even when the packaging is long gone.</p></header>
      <button className="search-launch card" onClick={() => onAdd("search")}><Search size={20} /><span>Search foods, brands or barcodes</span><kbd>+</kbd></button>
      <section className="feature-actions">
        <button onClick={() => onAdd("scan")}><span className="action-icon mint"><ScanLine /></span><strong>Scan barcode</strong><small>Package lookup</small></button>
        <button onClick={() => onAdd("label")}><span className="action-icon blue"><Camera /></span><strong>Read label</strong><small>AI assisted</small></button>
        <button onClick={() => onAdd("manual")}><span className="action-icon amber"><Pencil /></span><strong>Custom food</strong><small>Save your usual</small></button>
      </section>
      {personalFoods.length > 0 && <section className="discover-list">
        <div className="section-heading"><div><span className="eyebrow">Made yours</span><h2>Your saved foods</h2></div><span className="subtle">{personalFoods.length} saved</span></div>
        <div className="card food-list">{personalFoods.map((food) => <FoodRow key={food.id} food={food} hideCalories={hideCalories} onSelect={() => onSelect(food)} />)}</div>
      </section>}
      {recent.length > 0 && <section className="discover-list">
        <div className="section-heading"><div><span className="eyebrow">Repeat without searching</span><h2>Recently logged</h2></div></div>
        <div className="card food-list">{recent.map((food) => <FoodRow key={food.id} food={food} hideCalories={hideCalories} onSelect={() => onSelect(food)} />)}</div>
      </section>}
      {!personalFoods.length && !recent.length && <section className="discover-list starter-section">
        <div className="starter-message"><div><span className="eyebrow">Start your shelf</span><h2>Save the foods you return to.</h2><p>Search, scan or add one from memory once. It will be ready for a one-tap log next time.</p></div><button className="text-button" onClick={() => onAdd("manual")}><Pencil size={16} />Add from memory</button></div>
        <div className="section-heading"><div><span className="eyebrow">Common starting points</span><h2>Reference foods</h2></div></div>
        <div className="card food-list">{starterFoods.map((food) => <FoodRow key={food.id} food={food} hideCalories={hideCalories} onSelect={() => onSelect(food)} />)}</div>
      </section>}
      <div className="data-credit"><Database size={16} /><span>Packaged-food search by Open Food Facts · ODbL</span></div>
    </main>
  );
}

function InsightsView({ meals, profile }: { meals: Meal[]; profile: Profile }) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = localDateKey(date);
    const total = sumNutrition(meals.filter((meal) => localDateKey(new Date(meal.createdAt)) === key).map((meal) => meal.nutrition));
    return { key, label: date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1), total };
  });
  const max = Math.max(profile.calorieTarget, ...days.map((day) => day.total.calories));
  const loggedDays = days.filter((day) => day.total.calories > 0);
  const average = loggedDays.length ? loggedDays.reduce((sum, day) => sum + day.total.calories, 0) / loggedDays.length : 0;
  const proteinAverage = loggedDays.length ? loggedDays.reduce((sum, day) => sum + day.total.protein, 0) / loggedDays.length : 0;
  return (
    <main className="page">
      <header className="page-header"><span className="eyebrow">No judgement</span><h1>Your rhythm</h1><p>A lightweight view of patterns—not another dashboard to manage.</p></header>
      <section className="summary-strip">
        {!profile.hideCalories && <div className="card"><span>Daily average</span><strong>{Math.round(average).toLocaleString()}</strong><small>kcal on logged days</small></div>}
        <div className="card"><span>Protein average</span><strong>{Math.round(proteinAverage)} g</strong><small>target {profile.proteinTarget} g</small></div>
        {profile.hideCalories && <div className="card"><span>Fibre average</span><strong>{Math.round(loggedDays.length ? loggedDays.reduce((sum, day) => sum + day.total.fiber, 0) / loggedDays.length : 0)} g</strong><small>target {profile.fiberTarget} g</small></div>}
      </section>
      {!profile.hideCalories && <section className="chart-card card">
        <div className="section-heading compact"><div><span className="eyebrow">Last 7 days</span><h2>Calories</h2></div><span className="legend"><i /> {profile.calorieTarget.toLocaleString()} target</span></div>
        <div className="chart-area">
          <div className="target-line" style={{ bottom: `${(profile.calorieTarget / max) * 100}%` }} />
          {days.map((day) => <div className="chart-column" key={day.key}><div className="chart-bar-wrap"><div className="chart-bar" style={{ height: `${(day.total.calories / max) * 100}%` }}><span>{day.total.calories ? Math.round(day.total.calories) : ""}</span></div></div><small>{day.label}</small></div>)}
        </div>
      </section>}
      <section className="insight-card card"><span className="action-icon mint"><Sparkles /></span><div><strong>{loggedDays.length < 3 ? "Your pattern will appear here" : profile.hideCalories ? "Your nutrient rhythm is taking shape" : average > profile.calorieTarget * 1.08 ? "A little above your target" : average < profile.calorieTarget * 0.75 ? "Your logged average is low" : "You’re close to your target"}</strong><p>{loggedDays.length < 3 ? "Log a few complete days. Partial days are never treated as failure." : profile.hideCalories ? "Use the weekly view to notice protein, fibre and meal patterns without energy numbers." : "Use the weekly view as a guide. One unusual meal or day does not define progress."}</p></div></section>
    </main>
  );
}

function TargetEditor({ profile, onSave, onCancel, onboarding = false }: { profile: Profile; onSave: (profile: Profile) => void; onCancel?: () => void; onboarding?: boolean }) {
  const [draft, setDraft] = useState(profile);
  const calculatedCalories = calculateCalories(draft);
  const calculatedMacros = calculateMacroTargets(calculatedCalories, draft.weightKg, draft.dietPreset);
  const update = <K extends keyof Profile>(key: K, value: Profile[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const save = () => onSave({
    ...draft,
    calorieTarget: calculatedCalories,
    proteinTarget: calculatedMacros.protein,
    carbsTarget: calculatedMacros.carbs,
    fatTarget: calculatedMacros.fat,
    onboardingDone: true,
  });
  return (
    <div className={onboarding ? "onboarding-form" : "profile-form"}>
      {onboarding && <div className="onboarding-intro"><span className="brand-mark large">C</span><span className="eyebrow">60-second setup</span><h1>Your targets, without the quiz marathon.</h1><p>These are a sensible starting point. You can edit them any time.</p></div>}
      <div className="form-grid two">
        <label><span>Sex</span><select value={draft.sex} onChange={(event) => update("sex", event.target.value as Sex)}><option value="male">Male</option><option value="female">Female</option></select></label>
        <label><span>Age</span><input type="number" inputMode="numeric" min="16" max="100" value={draft.age} onChange={(event) => update("age", Number(event.target.value))} /></label>
        <label><span>Height</span><div className="input-suffix"><input type="number" inputMode="decimal" min="120" max="230" value={draft.heightCm} onChange={(event) => update("heightCm", Number(event.target.value))} /><span>cm</span></div></label>
        <label><span>Weight</span><div className="input-suffix"><input type="number" inputMode="decimal" min="35" max="300" step="0.1" value={draft.weightKg} onChange={(event) => update("weightKg", Number(event.target.value))} /><span>kg</span></div></label>
      </div>
      <label><span>Daily movement</span><select value={draft.activity} onChange={(event) => update("activity", event.target.value as ActivityLevel)}><option value="sedentary">Mostly seated</option><option value="light">Light · 1–2 workouts/week</option><option value="moderate">Moderate · 2–4 workouts/week</option><option value="active">Active · 5–6 workouts/week</option><option value="very-active">Very active · physical work/training</option></select></label>
      <div className="field-block"><span>Goal</span><div className="segmented three"><button className={draft.goalMode === "lose" ? "active" : ""} onClick={() => update("goalMode", "lose" as GoalMode)}>Lose</button><button className={draft.goalMode === "maintain" ? "active" : ""} onClick={() => update("goalMode", "maintain" as GoalMode)}>Maintain</button><button className={draft.goalMode === "gain" ? "active" : ""} onClick={() => update("goalMode", "gain" as GoalMode)}>Gain</button></div></div>
      <div className="field-block"><span>Nutrition style <small>optional</small></span><div className="preset-grid">{(Object.keys(dietMeta) as DietPreset[]).map((preset) => <button key={preset} className={draft.dietPreset === preset ? "active" : ""} onClick={() => update("dietPreset", preset)}><strong>{dietMeta[preset].label}</strong><small>{dietMeta[preset].description}</small>{draft.dietPreset === preset && <Check size={17} />}</button>)}</div></div>
      <div className="calculated-target card">
        {!draft.hideCalories && <div><span>Starting target</span><strong>{calculatedCalories.toLocaleString()} <small>kcal</small></strong></div>}
        <div className="target-macros"><span>P <strong>{calculatedMacros.protein} g</strong></span><span>C <strong>{calculatedMacros.carbs} g</strong></span><span>F <strong>{calculatedMacros.fat} g</strong></span></div>
      </div>
      {onboarding ? <button className="primary-button full" onClick={save}>Start tracking<ChevronRight size={18} /></button> : <div className="target-editor-actions"><button className="secondary-button" type="button" onClick={onCancel}>Cancel</button><button className="primary-button" type="button" onClick={save}>Save adjustments<ChevronRight size={18} /></button></div>}
      <p className="form-footnote">Calculated with Mifflin–St Jeor. Treat the result as a starting estimate and adjust from your weight trend.</p>
    </div>
  );
}

function TargetSummary({ profile, onEdit }: { profile: Profile; onEdit: () => void }) {
  return (
    <section className="targets-section">
      <div className="section-heading"><div><span className="eyebrow">Your daily plan</span><h2>Targets</h2></div><button className="secondary-button target-edit-button" type="button" onClick={onEdit}><Pencil size={16} />Adjust targets</button></div>
      <div className="target-summary card">
        {!profile.hideCalories && <div><span>Energy</span><strong>{profile.calorieTarget.toLocaleString()} <small>kcal</small></strong></div>}
        <div className="target-macros"><span>Protein <strong>{profile.proteinTarget} g</strong></span><span>Carbs <strong>{profile.carbsTarget} g</strong></span><span>Fat <strong>{profile.fatTarget} g</strong></span></div>
      </div>
    </section>
  );
}

function DisplayPreferences({ hideCalories, onChange }: { hideCalories: boolean; onChange: (hideCalories: boolean) => void }) {
  return (
    <section className="display-section">
      <div className="section-heading"><div><span className="eyebrow">App display</span><h2>Calorie visibility</h2></div></div>
      <button className={`display-preference ${hideCalories ? "active" : ""}`} type="button" aria-pressed={hideCalories} onClick={() => onChange(!hideCalories)}><span><strong>{hideCalories ? "Calories are hidden" : "Calories are visible"}</strong><small>{hideCalories ? "Your diary and insights focus on macros and nutrients." : "Hide calorie numbers throughout the app whenever you prefer."}</small></span><span className="toggle" /></button>
    </section>
  );
}

function AccountCard({
  configured,
  user,
  syncState,
  onSendMagicLink,
  onSignInWithProvider,
  onSignOut,
}: {
  configured: boolean;
  user: CloudUser | null;
  syncState: SyncState;
  onSendMagicLink: (email: string) => Promise<void>;
  onSignInWithProvider: (provider: SocialAuthProvider) => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const signInWithProvider = async (provider: SocialAuthProvider) => {
    setBusy(true); setNotice("");
    try {
      await onSignInWithProvider(provider);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : `Could not start ${provider} sign-in.`);
      setBusy(false);
    }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    setBusy(true); setNotice("");
    try {
      await onSendMagicLink(email.trim());
      setNotice("Check your email for the secure sign-in link.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The sign-in link could not be sent.");
    } finally { setBusy(false); }
  };
  const statusText: Record<SyncState, string> = {
    local: "Saved on this device",
    syncing: "Syncing changes…",
    synced: "Up to date across devices",
    offline: "Saved offline · will retry",
    error: "Sync needs attention",
  };
  return (
    <section className="account-section">
      <div className="section-heading"><div><span className="eyebrow">Optional account</span><h2>Account & sync</h2></div></div>
      <div className="account-card card">
        {!configured ? (
          <div className="account-message"><Cloud /><div><strong>Cloud sync needs project setup</strong><p>The app remains fully usable on this device until Supabase is connected.</p></div></div>
        ) : user ? (
          <>
            <div className="account-user"><span><Cloud size={20} /></span><div><strong>{user.email || "Signed-in account"}</strong><small>{statusText[syncState]}</small></div></div>
            <button className="secondary-button" onClick={onSignOut}><LogOut size={17} />Sign out</button>
          </>
        ) : (
          <>
            <div className="account-message"><Cloud /><div><strong>Use your diary on every device</strong><p>Sign in with a one-time email link. You can keep using guest mode without an account.</p></div></div>
            <form className="magic-link-form" onSubmit={submit}>
              <label><span>Email</span><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
              <button className="primary-button" type="submit" disabled={busy}><Mail size={17} />{busy ? "Sending…" : "Email sign-in link"}</button>
            </form>
            <div className="account-divider"><span>or</span></div>
            <div className="social-auth-buttons">
              <button className="secondary-button" type="button" disabled={busy} onClick={() => signInWithProvider("google")}><GoogleIcon />Continue with Google</button>
            </div>
            {notice && <p className="account-notice">{notice}</p>}
          </>
        )}
      </div>
    </section>
  );
}

function ProfileView({
  profile,
  onSave,
  onImport,
  configured,
  user,
  syncState,
  onSendMagicLink,
  onSignInWithProvider,
  onSignOut,
}: {
  profile: Profile;
  onSave: (profile: Profile) => void;
  onImport: (data: { meals?: Meal[]; foods?: Food[]; profile?: Profile }) => Promise<void>;
  configured: boolean;
  user: CloudUser | null;
  syncState: SyncState;
  onSendMagicLink: (email: string) => Promise<void>;
  onSignInWithProvider: (provider: SocialAuthProvider) => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  const importRef = useRef<HTMLInputElement>(null);
  const [editingTargets, setEditingTargets] = useState(false);
  const download = async () => {
    const data = await exportData();
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `calorie-flow-${localDateKey()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const upload = async (file?: File) => {
    if (!file) return;
    await onImport(JSON.parse(await file.text()));
  };
  return (
    <main className="page">
      <header className="page-header"><span className="eyebrow">Your plan</span><h1>Targets</h1><p>Set them once. Everything else stays out of the way.</p></header>
      <TargetSummary profile={profile} onEdit={() => setEditingTargets(true)} />
      {editingTargets && <TargetEditor profile={profile} onSave={(next) => { onSave(next); setEditingTargets(false); }} onCancel={() => setEditingTargets(false)} />}
      <DisplayPreferences hideCalories={profile.hideCalories} onChange={(hideCalories) => onSave({ ...profile, hideCalories })} />
      <AccountCard configured={configured} user={user} syncState={syncState} onSendMagicLink={onSendMagicLink} onSignInWithProvider={onSignInWithProvider} onSignOut={onSignOut} />
      <section className="data-tools">
        <div className="section-heading"><div><span className="eyebrow">Your data</span><h2>Portable by design</h2></div></div>
        <div className="card tool-list">
          <button onClick={download}><Download size={19} /><span><strong>Export backup</strong><small>Meals, custom foods and targets</small></span><ChevronRight size={17} /></button>
          <button onClick={() => importRef.current?.click()}><Upload size={19} /><span><strong>Restore backup</strong><small>Import a Calorie Flow JSON file</small></span><ChevronRight size={17} /></button>
          <input ref={importRef} type="file" accept="application/json" hidden onChange={(event) => upload(event.target.files?.[0])} />
        </div>
        <div className="privacy-note"><ShieldCheck size={18} /><div><strong>Private by default, portable when you choose.</strong><p>Guest data stays in this browser. Signed-in data is isolated by account-level database rules. Label photos go to OpenAI only when you choose that action.</p></div></div>
      </section>
    </main>
  );
}

function Sheet({ children, onClose, wide = false }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("sheet-open");
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.classList.remove("sheet-open"); };
  }, [onClose]);
  return <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={`sheet ${wide ? "wide" : ""}`}><div className="sheet-handle" />{children}</section></div>;
}

function BarcodeScanner({ onResult, onClose }: { onResult: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | undefined>(undefined);
  const [manual, setManual] = useState("");
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [cameraLive, setCameraLive] = useState(false);

  const cameraError = (caught: unknown) => {
    const name = caught instanceof DOMException ? caught.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") return "Camera access is off for this site. Allow Camera in your iPhone’s Safari or Home Screen app settings, then try again.";
    if (name === "NotFoundError") return "No usable camera was found on this device.";
    if (name === "NotReadableError") return "Your camera is busy in another app. Close that app and try again.";
    return "The camera could not start. You can enter the barcode manually below.";
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not support camera scanning. Enter the barcode below.");
      return;
    }
    setStarting(true); setError("");
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromConstraints({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      }, videoRef.current!, (result) => {
        if (result) {
          controlsRef.current?.stop();
          onResult(result.getText());
        }
      });
      controlsRef.current = controls;
      setCameraLive(true);
    } catch (caught) {
      setError(cameraError(caught));
    } finally { setStarting(false); }
  };

  useEffect(() => {
    return () => controlsRef.current?.stop();
  }, []);

  return (
    <div className="scanner-view">
      <div className="sheet-header"><button className="icon-button ghost" onClick={onClose}><ArrowLeft /></button><div><span className="eyebrow">Package lookup</span><h2>Scan barcode</h2></div><span /></div>
      <div className={`camera-frame ${cameraLive ? "live" : ""}`}>
        <video ref={videoRef} muted playsInline autoPlay />
        {cameraLive ? <><div className="scan-line" /><div className="scan-corners" /></> : <button className="camera-start" onClick={startCamera} disabled={starting}><Camera size={22} /><strong>{starting ? "Opening camera…" : "Open rear camera"}</strong><small>Point it at the barcode</small></button>}
      </div>
      <p className="camera-hint">{cameraLive ? "Hold the barcode inside the frame" : "You’ll be asked to allow camera access."}</p>
      {error && <div className="inline-alert"><WifiOff size={17} />{error}</div>}
      <form className="manual-barcode" onSubmit={(event) => { event.preventDefault(); if (manual.trim()) onResult(manual.trim()); }}><label><span>Or enter the number</span><input value={manual} inputMode="numeric" onChange={(event) => setManual(event.target.value)} placeholder="e.g. 3800123456789" /></label><button className="secondary-button" type="submit">Look up</button></form>
    </div>
  );
}

async function imageToDataUrl(file: File) {
  const image = await createImageBitmap(file);
  const max = 1600;
  const scale = Math.min(1, max / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext("2d");
  context?.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  return canvas.toDataURL("image/jpeg", 0.86);
}

function LabelReader({ onFood, onClose, initialFiles = [] }: { onFood: (food: Food, questions: string[]) => void; onClose: () => void; initialFiles?: File[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const initialFilesRef = useRef(initialFiles);
  const analyzeRef = useRef<(files?: FileList | File[]) => Promise<void>>(undefined);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cameraLive, setCameraLive] = useState(false);
  const [starting, setStarting] = useState(false);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = undefined;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraLive(false);
  };
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const analyzeImages = async (images: string[]) => {
    setError(""); setLoading(true);
    try {
      setPreviews(images);
      const session = await getSupabase()?.auth.getSession();
      const token = session?.data.session?.access_token;
      const response = await fetch("/api/analyze-label", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ images }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The label could not be read.");
      const result = body as LabelAnalysis;
      onFood({
        id: `ai-${crypto.randomUUID()}`,
        name: result.productName || "Scanned label",
        brand: result.brand || undefined,
        barcode: result.barcode || undefined,
        servingGrams: result.servingSizeG || undefined,
        packageGrams: result.packageSizeG || undefined,
        nutrientsPer100: result.per100,
        source: "ai-label",
      }, result.followUpQuestions);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The label could not be read.");
    } finally { setLoading(false); }
  };

  const analyze = async (files?: FileList | File[]) => {
    if (!files?.length) return;
    try {
      await analyzeImages(await Promise.all(Array.from(files).slice(0, 3).map(imageToDataUrl)));
    } catch {
      setError("That photo could not be opened. Try taking a fresh picture of the nutrition table.");
    }
  };
  useEffect(() => { analyzeRef.current = analyze; });

  useEffect(() => {
    const timer = initialFilesRef.current.length ? window.setTimeout(() => { void analyzeRef.current?.(initialFilesRef.current); }, 0) : undefined;
    // The initial files are intentionally consumed once when this reader opens.
    return () => { if (timer) window.clearTimeout(timer); };
  }, []);

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not support the camera. Choose a photo instead.");
      return;
    }
    setStarting(true); setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraLive(true);
    } catch (caught) {
      const name = caught instanceof DOMException ? caught.name : "";
      setError(name === "NotAllowedError" || name === "SecurityError" ? "Camera access is off for this site. Allow Camera in your iPhone’s Safari or Home Screen app settings, then try again." : "The camera could not start. Choose a photo instead.");
    } finally { setStarting(false); }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setError("The camera is still getting ready. Try again in a moment.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL("image/jpeg", 0.9);
    stopCamera();
    await analyzeImages([image]);
  };

  return (
    <div>
      <div className="sheet-header"><button className="icon-button ghost" onClick={onClose}><ArrowLeft /></button><div><span className="eyebrow">AI assist</span><h2>Read nutrition label</h2></div><span /></div>
      {cameraLive ? <div className="label-camera-live"><div className="camera-frame live"><video ref={videoRef} muted playsInline autoPlay /><div className="scan-corners" /></div><button className="primary-button full" onClick={capture} disabled={loading}><Camera size={18} />Capture label</button><button className="text-button camera-cancel" onClick={stopCamera}>Cancel camera</button></div> : <div className={`label-dropzone ${previews.length ? "has-preview" : ""}`}>
        {previews.length ? <div className="package-previews">{previews.map((preview) => <img key={preview} src={preview} alt="Selected package detail" />)}</div> : <><span className="action-icon blue"><Camera /></span><strong>Add the package details</strong><small>Label, barcode, and package size work best together</small></>}
        {loading && <span className="analyzing"><i /><strong>Reading the package…</strong></span>}
      </div>}
      {!cameraLive && <div className="label-camera-actions"><button className="primary-button" onClick={startCamera} disabled={starting}><Camera size={18} />{starting ? "Opening camera…" : "Open rear camera"}</button><button className="secondary-button" onClick={() => inputRef.current?.click()}><Upload size={18} />Choose photo</button></div>}
      <input ref={inputRef} className="visually-hidden-file" type="file" accept="image/*" capture="environment" multiple onChange={(event) => analyze(event.target.files || undefined)} />
      {error && <div className="inline-alert error"><Info size={17} /><span>{error}</span></div>}
      <div className="label-tips"><strong>For the best result</strong><ul><li>Add up to three details: nutrition table, barcode, and package size.</li><li>One photo is fine when it has everything.</li><li>You’ll confirm the amount and meal before anything is logged.</li></ul></div>
    </div>
  );
}

function ManualFood({ initialBarcode, onSave, onClose, hideCalories }: { initialBarcode?: string; onSave: (food: Food) => void; onClose: () => void; hideCalories: boolean }) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [barcode, setBarcode] = useState(initialBarcode || "");
  const [servingGrams, setServingGrams] = useState(100);
  const [nutrition, setNutrition] = useState<Nutrition>({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 });
  const updateNutrition = (key: keyof Nutrition, value: string) => setNutrition((current) => ({ ...current, [key]: Number(value) || 0 }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const calories = hideCalories ? round(nutrition.protein * 4 + nutrition.carbs * 4 + nutrition.fat * 9, 0) : nutrition.calories;
    if (!name.trim() || !calories) return;
    onSave({ id: `custom-${crypto.randomUUID()}`, name: name.trim(), brand: brand.trim() || undefined, barcode: barcode || undefined, servingGrams: servingGrams || 100, nutrientsPer100: { ...nutrition, calories }, source: "custom" });
  };
  return (
    <form onSubmit={submit}>
      <div className="sheet-header"><button type="button" className="icon-button ghost" onClick={onClose}><ArrowLeft /></button><div><span className="eyebrow">Full control</span><h2>Custom food</h2></div><span /></div>
      <div className="form-grid two"><label className="span-two"><span>Food name</span><input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Homemade meatballs" /></label><label><span>Brand <small>optional</small></span><input value={brand} onChange={(event) => setBrand(event.target.value)} /></label><label><span>Barcode <small>optional</small></span><input inputMode="numeric" value={barcode} onChange={(event) => setBarcode(event.target.value)} /></label></div>
      <div className="nutrition-entry"><div className="entry-heading"><div><strong>Nutrition per 100 g</strong><small>{hideCalories ? "Energy is calculated quietly from macros" : "Copy the package values"}</small></div><Package size={20} /></div><div className="form-grid three">{!hideCalories && <label><span>Calories</span><input required type="number" inputMode="decimal" value={nutrition.calories || ""} onChange={(event) => updateNutrition("calories", event.target.value)} /></label>}<label><span>Protein</span><input type="number" inputMode="decimal" step="0.1" value={nutrition.protein || ""} onChange={(event) => updateNutrition("protein", event.target.value)} /></label><label><span>Carbs</span><input type="number" inputMode="decimal" step="0.1" value={nutrition.carbs || ""} onChange={(event) => updateNutrition("carbs", event.target.value)} /></label><label><span>Fat</span><input type="number" inputMode="decimal" step="0.1" value={nutrition.fat || ""} onChange={(event) => updateNutrition("fat", event.target.value)} /></label><label><span>Fibre</span><input type="number" inputMode="decimal" step="0.1" value={nutrition.fiber || ""} onChange={(event) => updateNutrition("fiber", event.target.value)} /></label><label><span>Sugar</span><input type="number" inputMode="decimal" step="0.1" value={nutrition.sugar || ""} onChange={(event) => updateNutrition("sugar", event.target.value)} /></label></div></div>
      <label><span>Default serving weight</span><div className="input-suffix"><input type="number" inputMode="decimal" min="0.1" value={servingGrams} onChange={(event) => setServingGrams(Number(event.target.value))} /><span>g</span></div></label>
      <button className="primary-button full" type="submit">Continue to amount<ChevronRight size={18} /></button>
    </form>
  );
}

function PortionSheet({ food, questions, onLog, onClose, hideCalories }: { food: Food; questions?: string[]; onLog: (meal: Meal, food: Food) => void; onClose: () => void; hideCalories: boolean }) {
  const units = contextualUnits(food);
  const initialUnit: ServingUnit = food.packageGrams ? "package" : food.servingGrams ? "serving" : "g";
  const [unit, setUnit] = useState<ServingUnit>(initialUnit);
  const [amount, setAmount] = useState(initialUnit === "g" ? 100 : 1);
  const [mealType, setMealType] = useState<MealType>(getMealType());
  const grams = gramsFor(food, amount, unit);
  const nutrition = scaleNutrition(food.nutrientsPer100, grams);
  const log = () => onLog({
    id: crypto.randomUUID(),
    foodId: food.id,
    name: food.name,
    brand: food.brand,
    mealType,
    amount,
    unit,
    grams,
    nutrition,
    createdAt: new Date().toISOString(),
    source: food.source,
    estimated: food.source === "ai-label" || !food.verified,
  }, { ...food, lastUsedAt: new Date().toISOString() });
  return (
    <div>
      <div className="sheet-header"><button className="icon-button ghost" onClick={onClose}><ArrowLeft /></button><div><span className="eyebrow">Confirm amount</span><h2>Log food</h2></div><span /></div>
      <div className="selected-food"><FoodAvatar food={food} /><div><strong>{food.name}</strong><span>{food.brand || food.quantityLabel || "Nutrition per 100 g"}</span></div>{!hideCalories && <div className="selected-calories"><strong>{nutrition.calories}</strong><small>kcal</small></div>}</div>
      {!!questions?.length && <div className="follow-up"><Sparkles size={18} /><div><strong>One detail still matters</strong>{questions.map((question) => <p key={question}>{question}</p>)}<small>Use grams below if the package or serving amount is unknown.</small></div></div>}
      <div className="amount-control"><button onClick={() => setAmount(Math.max(unit === "g" ? 1 : 0.25, round(amount - (unit === "g" || unit === "ml" ? 10 : 0.5), 2)))}>−</button><label><input aria-label="Amount" type="number" inputMode="decimal" min="0.01" step="any" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /><span>{formatUnit(unit, amount)}</span></label><button onClick={() => setAmount(round(amount + (unit === "g" || unit === "ml" ? 10 : 0.5), 2))}>+</button></div>
      <div className="unit-scroll">{units.map((option) => <button key={option} className={unit === option ? "active" : ""} onClick={() => { setUnit(option); setAmount(option === "g" || option === "ml" ? 100 : 1); }}>{unitLabels[option]}</button>)}</div>
      {(unit === "tbsp" || unit === "tsp" || unit === "ml") && <p className="estimate-note"><Info size={14} /> Volume-to-weight conversion is approximate unless the food provides it.</p>}
      <div className="nutrition-preview"><div><span>Protein</span><strong>{nutrition.protein} g</strong></div><div><span>Carbs</span><strong>{nutrition.carbs} g</strong></div><div><span>Fat</span><strong>{nutrition.fat} g</strong></div><div><span>Fibre</span><strong>{nutrition.fiber} g</strong></div></div>
      <div className="field-block"><span>Add to</span><div className="segmented four">{(Object.keys(mealLabels) as MealType[]).map((type) => <button key={type} className={mealType === type ? "active" : ""} onClick={() => setMealType(type)}>{mealLabels[type]}</button>)}</div></div>
      <button className="primary-button full" onClick={log}><Plus size={18} />{hideCalories ? "Log food" : `Log ${nutrition.calories} kcal`}</button>
      <p className="form-footnote">{grams} g total · {food.source === "open-food-facts" ? "Open Food Facts" : food.source === "ai-label" ? "AI-extracted—check the package" : food.source === "custom" ? "Your custom food" : "Generic reference value"}</p>
    </div>
  );
}

function AddFoodSheet({ foods, initialView = "start", onClose, onLog, hideCalories }: { foods: Food[]; initialView?: AddView; onClose: () => void; onLog: (meal: Meal, food: Food) => void; hideCalories: boolean }) {
  const [view, setView] = useState<AddView>(initialView);
  const [selected, setSelected] = useState<Food>();
  const [questions, setQuestions] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unknownBarcode, setUnknownBarcode] = useState("");
  const [intakeDraft, setIntakeDraft] = useState("");
  const [coachReply, setCoachReply] = useState("");
  const [askingCoach, setAskingCoach] = useState(false);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const recent = [...foods].filter((food) => food.lastUsedAt).sort((a, b) => (b.lastUsedAt || "").localeCompare(a.lastUsedAt || "")).slice(0, 6);
  const pick = (food: Food, followUps: string[] = []) => { setSelected(food); setQuestions(followUps); };
  const runSearch = async (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) { setResults([]); return; }
    const local = foods.filter((food) => `${food.name} ${food.brand || ""} ${food.barcode || ""}`.toLowerCase().includes(normalized)).slice(0, 10);
    setResults(local); setLoading(true); setError("");
    try {
      const remote = await searchOpenFoodFacts(value.trim());
      const localIds = new Set(local.map((food) => food.id));
      setResults([...local, ...remote.filter((food) => !localIds.has(food.id))].slice(0, 25));
    } catch { if (!local.length) setError("Online food search is unavailable. You can still add a custom food."); }
    finally { setLoading(false); }
  };
  const search = async (event?: FormEvent) => { event?.preventDefault(); await runSearch(query); };
  const sendIntake = async (event: FormEvent) => {
    event.preventDefault();
    const message = intakeDraft.trim();
    if (!message || askingCoach) return;
    const soundsConversational = /\b(i|my|me|how|what|can|should|help|ate|eaten|bite|bites|slice|slices|calorie|protein|macro|portion)\b|[?]/i.test(message);
    setCoachReply(""); setError("");
    if (!soundsConversational) {
      setQuery(message); setView("search"); await runSearch(message);
      return;
    }
    setAskingCoach(true);
    try {
      const session = await getSupabase()?.auth.getSession();
      const token = session?.data.session?.access_token;
      if (!token) throw new Error("Sign in to ask the Coach about your log.");
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message, history: [], localDate: localDateKey(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The Coach is unavailable right now.");
      setCoachReply(body.reply);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The Coach is unavailable right now.");
    } finally { setAskingCoach(false); }
  };
  const addImages = (files?: FileList | File[]) => {
    if (!files?.length) return;
    setPendingImages(Array.from(files).slice(0, 3));
    setView("label");
  };
  const barcode = async (code: string, fallback?: Food, followUps: string[] = []) => {
    setLoading(true); setError("");
    const cached = foods.find((food) => food.barcode === code);
    if (cached) { setLoading(false); pick(cached, followUps); return; }
    try {
      const food = await findByBarcode(code);
      if (food) pick(food, followUps);
      else if (fallback) pick(fallback, followUps);
      else { setUnknownBarcode(code); setView("manual"); }
    } catch {
      if (fallback) pick(fallback, followUps);
      else { setUnknownBarcode(code); setView("manual"); setError("This barcode wasn’t found. Add the label once and it will be saved on this device."); }
    }
    finally { setLoading(false); }
  };
  if (selected) return <PortionSheet food={selected} questions={questions} hideCalories={hideCalories} onLog={onLog} onClose={() => setSelected(undefined)} />;
  if (view === "scan") return <>{loading && <div className="global-loader"><i />Looking up product…</div>}<BarcodeScanner onResult={barcode} onClose={() => setView("start")} /></>;
  if (view === "label") return <LabelReader initialFiles={pendingImages} onFood={(food, followUps) => { if (food.barcode) void barcode(food.barcode, food, followUps); else pick(food, followUps); }} onClose={() => { setPendingImages([]); setView("start"); }} />;
  if (view === "manual") return <><ManualFood initialBarcode={unknownBarcode} hideCalories={hideCalories} onSave={pick} onClose={() => setView("start")} />{error && <div className="inline-alert error"><Info size={17} />{error}</div>}</>;
  if (view === "search") return (
    <div>
      <div className="sheet-header"><button className="icon-button ghost" onClick={() => setView("start")}><ArrowLeft /></button><div><span className="eyebrow">Food database</span><h2>Search</h2></div><button className="icon-button ghost" onClick={onClose}><X /></button></div>
      <form className="sheet-search" onSubmit={search}><Search size={19} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Food, brand or barcode" /><button type="submit">Search</button></form>
      {loading && <div className="search-status"><i />Searching local and packaged foods…</div>}
      {error && <div className="inline-alert"><WifiOff size={17} />{error}</div>}
      <div className="food-list sheet-food-list">{results.map((food) => <FoodRow key={food.id} food={food} hideCalories={hideCalories} onSelect={() => pick(food)} />)}</div>
      {!loading && query && results.length === 0 && <div className="search-empty"><Database /><strong>No match yet</strong><p>Create it once; next time it will be waiting.</p><button className="secondary-button" onClick={() => setView("manual")}>Add custom food</button></div>}
      {!query && <div className="quick-list"><span className="eyebrow">Try something simple</span>{foods.slice(0, 6).map((food) => <FoodRow key={food.id} food={food} hideCalories={hideCalories} onSelect={() => pick(food)} />)}</div>}
      <div className="data-credit"><Database size={15} /><span>Product results by Open Food Facts · ODbL</span></div>
    </div>
  );
  return (
    <div className="coach-intake" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addImages(event.dataTransfer.files); }}>
      <div className="sheet-header"><button className="icon-button ghost" onClick={onClose}><X /></button><div><span className="eyebrow">Log with Coach</span><h2>Add food or get help</h2></div><span /></div>
      <div className="intake-actions"><button onClick={() => setView("scan")}><ScanLine size={17} />Barcode</button><button onClick={() => { setPendingImages([]); setView("label"); }}><Camera size={17} />Take photo</button><button onClick={() => imageInputRef.current?.click()}><Upload size={17} />Add photos</button></div>
      <input ref={imageInputRef} className="visually-hidden-file" type="file" accept="image/*" capture="environment" multiple onChange={(event) => addImages(event.target.files || undefined)} />
      <label className="intake-input-label" htmlFor="coach-intake">Search a food or ask Coach</label>
      <form className="intake-composer" onSubmit={sendIntake}><input id="coach-intake" autoFocus value={intakeDraft} onChange={(event) => setIntakeDraft(event.target.value)} placeholder="Food or question" /><button type="submit" disabled={!intakeDraft.trim() || askingCoach} aria-label="Send to Coach">{askingCoach ? <span className="coach-loader" /> : <Send />}</button></form>
      {coachReply && <div className="intake-reply"><span>Coach</span><p>{coachReply}</p><button className="text-button" onClick={() => { setQuery(intakeDraft); setView("search"); void runSearch(intakeDraft); }}><Search size={16} />Find a food to log</button></div>}
      {error && <div className="inline-alert error"><Info size={17} />{error}</div>}
      {!!recent.length && <div className="quick-list"><span className="eyebrow">Recent · one tap</span>{recent.map((food) => <FoodRow key={food.id} food={food} hideCalories={hideCalories} onSelect={() => pick(food)} />)}</div>}
      <button className="text-button intake-manual" onClick={() => setView("manual")}><Pencil size={16} />Enter food manually</button>
      <div className="simple-note"><ShieldCheck size={17} /><span>Barcode and saved-food search work directly. Package photos are sent to AI only after you add them.</span></div>
    </div>
  );
}

type DisplayCoachMessage = CoachMessage & { sources?: Array<{ title: string; url: string }> };

function CoachView({ configured, user, onOpenAccount, hideCalories }: { configured: boolean; user: CloudUser | null; onOpenAccount: () => void; hideCalories: boolean }) {
  const [messages, setMessages] = useState<DisplayCoachMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadedUserId, setLoadedUserId] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    if (!user) return;
    getCloudCoachMessages(user.id).then((stored) => { if (active) { setMessages(stored); setLoadedUserId(user.id); } }).catch(() => {
      if (active) { setMessages([]); setLoadedUserId(user.id); setError("Coach history could not be loaded."); }
    });
    return () => { active = false; };
  }, [user]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, loading]);

  const send = async (suggestion?: string) => {
    const content = (suggestion ?? draft).trim();
    if (!content || !user || loading || loadedUserId !== user.id) return;
    const userMessage: DisplayCoachMessage = { id: crypto.randomUUID(), role: "user", content, createdAt: new Date().toISOString() };
    const history = messages.slice(-12).map(({ role, content: previous }) => ({ role, content: previous }));
    setMessages((current) => [...current, userMessage]); setDraft(""); setError(""); setLoading(true);
    try {
      await saveCloudCoachMessage(user.id, userMessage);
      const session = await getSupabase()?.auth.getSession();
      const token = session?.data.session?.access_token;
      if (!token) throw new Error("Your session expired. Please sign in again.");
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: content,
          history,
          localDate: localDateKey(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The Coach is unavailable right now.");
      const assistantMessage: DisplayCoachMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: body.reply,
        createdAt: new Date().toISOString(),
        sources: Array.isArray(body.sources) ? body.sources : undefined,
      };
      setMessages((current) => [...current, assistantMessage]);
      await saveCloudCoachMessage(user.id, assistantMessage);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The Coach is unavailable right now.");
    } finally { setLoading(false); }
  };
  const clear = async () => {
    if (!user || !messages.length) return;
    await clearCloudCoachMessages(user.id);
    setMessages([]);
  };

  if (!configured) return (
    <main className="page coach-page"><header className="page-header"><span className="eyebrow">Nutrition only</span><h1>Coach</h1><p>{hideCalories ? "Nutrition guidance using your actual diary." : "Calorie-aware guidance using your actual diary."}</p></header><section className="coach-gate card"><MessageCircle /><h2>Coach setup is waiting</h2><p>Connect the project database and OpenAI key to activate private, diary-aware coaching.</p></section></main>
  );
  if (!user) return (
    <main className="page coach-page"><header className="page-header"><span className="eyebrow">Nutrition only</span><h1>Coach</h1><p>{hideCalories ? "Nutrition guidance using your actual diary." : "Calorie-aware guidance using your actual diary."}</p></header><section className="coach-gate card"><MessageCircle /><h2>Sign in for private coaching</h2><p>The Coach reads only the signed-in user’s targets, meals, and saved foods. Guest tracking still works without an account.</p><button className="primary-button" onClick={onOpenAccount}><Mail size={17} />Open account setup</button></section></main>
  );
  if (loadedUserId !== user.id) return (
    <main className="page coach-page"><header className="page-header"><span className="eyebrow">Your diary, in context</span><h1>Coach</h1></header><section className="coach-gate card"><span className="coach-loader" /><h2>Loading your private Coach…</h2></section></main>
  );

  const starters = [hideCalories ? "How are my nutrients today?" : "How am I doing today?", "Suggest a high-protein dinner", "Find a healthy lunch near Sofia"];
  return (
    <main className="page coach-page">
      <header className="coach-header"><div><span className="eyebrow">Your diary, in context</span><h1>Coach</h1></div>{messages.length > 0 && <button className="text-button muted" onClick={clear}>Clear chat</button>}</header>
      <div className="coach-scope"><ShieldCheck size={15} /><span>{hideCalories ? "Food and nutrition only" : "Food, calories and nutrition only"} · location is used only when you type it</span></div>
      <section className="coach-thread" aria-live="polite">
        {messages.length === 0 && <div className="coach-welcome"><span className="coach-orb"><Sparkles /></span><h2>Ask with your log attached.</h2><p>I can check your totals, spot patterns, suggest meals from your targets, or find food places when you provide a location.</p><div className="coach-starters">{starters.map((starter) => <button key={starter} onClick={() => send(starter)}>{starter}</button>)}</div></div>}
        {messages.map((message) => <article key={message.id} className={`coach-message ${message.role}`}><span>{message.role === "assistant" ? "Coach" : "You"}</span><p>{message.content}</p>{!!message.sources?.length && <div className="coach-sources"><strong>Sources</strong>{message.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}</div>}</article>)}
        {loading && <div className="coach-typing"><i /><i /><i /><span>Coach is checking your diary…</span></div>}
        {error && <div className="inline-alert error"><Info size={17} /><span>{error}</span></div>}
        <div ref={endRef} />
      </section>
      <form className="coach-composer" onSubmit={(event) => { event.preventDefault(); send(); }}>
        <input aria-label="Message the nutrition Coach" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={6000} placeholder="Ask about today, a meal, or food nearby…" />
        <button type="submit" disabled={!draft.trim() || loading} aria-label="Send"><Send /></button>
      </form>
    </main>
  );
}

function BottomNav({ tab, onChange, onAdd }: { tab: Tab; onChange: (tab: Tab) => void; onAdd: () => void }) {
  const items: Array<{ tab: Tab; label: string; icon: React.ReactNode }> = [
    { tab: "today", label: "Today", icon: <Home /> },
    { tab: "search", label: "Foods", icon: <Search /> },
    { tab: "insights", label: "Insights", icon: <BarChart3 /> },
    { tab: "profile", label: "Targets", icon: <UserRound /> },
  ];
  return <nav className="bottom-nav">{items.slice(0, 2).map((item) => <button key={item.tab} className={tab === item.tab ? "active" : ""} onClick={() => onChange(item.tab)}>{item.icon}<span>{item.label}</span></button>)}<button className="add-button" onClick={onAdd} aria-label="Add food"><Plus /></button>{items.slice(2).map((item) => <button key={item.tab} className={tab === item.tab ? "active" : ""} onClick={() => onChange(item.tab)}>{item.icon}<span>{item.label}</span></button>)}</nav>;
}

function AuthGateway({
  configured,
  onSignIn,
  onSignUp,
  onSignInWithProvider,
  onRequestPasswordReset,
  onUpdatePassword,
  passwordRecovery,
}: {
  configured: boolean;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  onSignInWithProvider: (provider: SocialAuthProvider) => Promise<void>;
  onRequestPasswordReset: (email: string) => Promise<void>;
  onUpdatePassword: (password: string) => Promise<void>;
  passwordRecovery: boolean;
}) {
  const [mode, setMode] = useState<AuthMode>(passwordRecovery ? "update-password" : "sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const isRegistering = mode === "register";
  const isPasswordReset = mode === "forgot-password" || mode === "update-password";
  const isUpdatingPassword = mode === "update-password";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!configured) return;
    if ((isRegistering || isUpdatingPassword) && password !== confirmPassword) {
      setNotice("Passwords do not match.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      if (mode === "forgot-password") {
        await onRequestPasswordReset(email.trim());
        setNotice("If an account exists for that email, a reset link is on its way.");
      } else if (isUpdatingPassword) {
        await onUpdatePassword(password);
        setNotice("Your password is updated. You can continue to your diary.");
      } else if (isRegistering) {
        const { needsEmailConfirmation } = await onSignUp(email.trim(), password);
        setNotice(needsEmailConfirmation ? "Check your inbox to confirm your account, then sign in." : "Your account is ready.");
      } else {
        await onSignIn(email.trim(), password);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "We couldn't complete that request.");
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    setBusy(true);
    setNotice("");
    try {
      await onSignInWithProvider("google");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Google sign-in could not start.");
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card card" aria-labelledby="auth-title">
        <div className="auth-brand"><span className="brand-mark large">C</span><span>Calorie Flow</span></div>
        <div><span className="eyebrow">{isRegistering ? "Create your account" : isUpdatingPassword ? "Choose a new password" : mode === "forgot-password" ? "Reset your password" : "Welcome back"}</span><h1 id="auth-title">{isRegistering ? "Start your flow" : isUpdatingPassword ? "Secure your diary" : mode === "forgot-password" ? "Get back in" : "Sign in to Calorie Flow"}</h1><p>{isRegistering ? "Save your diary privately and keep it in sync across your devices." : isUpdatingPassword ? "Use a new password you have not used elsewhere." : mode === "forgot-password" ? "We’ll email a secure reset link if this address has an account." : "Pick up right where you left off."}</p></div>
        {!configured ? <p className="auth-unavailable"><LockKeyhole size={16} />Account sign-in needs Supabase configuration. You can still use Calorie Flow locally.</p> : <>
          <form className="auth-form" onSubmit={submit}>
            {!isUpdatingPassword && <label><span>Email</span><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>}
            {mode !== "forgot-password" && <label><span>{isRegistering || isUpdatingPassword ? "New password" : "Password"}</span><input type="password" autoComplete={isRegistering || isUpdatingPassword ? "new-password" : "current-password"} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" /></label>}
            {(isRegistering || isUpdatingPassword) && <label><span>Confirm password</span><input type="password" autoComplete="new-password" minLength={6} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat your password" /></label>}
            <button className="primary-button" type="submit" disabled={busy}>{busy ? "Please wait…" : isRegistering ? "Create account" : isUpdatingPassword ? "Save new password" : mode === "forgot-password" ? "Email reset link" : "Sign in"}</button>
          </form>
          {!isPasswordReset && <><div className="account-divider"><span>or</span></div><button className="secondary-button auth-google" type="button" disabled={busy} onClick={signInWithGoogle}><GoogleIcon />Continue with Google</button></>}
          {notice && <p className="account-notice" role="status">{notice}</p>}
        </>}
        {!isPasswordReset && <><p className="auth-switch">{isRegistering ? "Already have an account?" : "New to Calorie Flow?"} <button type="button" onClick={() => { setMode(isRegistering ? "sign-in" : "register"); setNotice(""); }}>{isRegistering ? "Sign in" : "Create an account"}</button></p>{mode === "sign-in" && <button className="auth-guest auth-recovery" type="button" onClick={() => { setMode("forgot-password"); setNotice(""); }}>Forgot your password?</button>}</>}
        {isPasswordReset && <button className="text-button auth-guest" type="button" onClick={() => { setMode("sign-in"); setNotice(""); }}>Back to sign in</button>}
      </section>
    </main>
  );
}

export function TrackerApp() {
  const auth = useAuth();
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [foods, setFoods] = useState<Food[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [tab, setTab] = useState<Tab>("today");
  const [dateKey, setDateKey] = useState(localDateKey());
  const [adding, setAdding] = useState(false);
  const [initialAddView, setInitialAddView] = useState<AddView>("start");
  const [directFood, setDirectFood] = useState<Food>();
  const [toast, setToast] = useState("");
  const [syncState, setSyncState] = useState<SyncState>("local");
  const [syncAttempt, setSyncAttempt] = useState(0);
  const syncIdentityRef = useRef("");

  const refresh = useCallback(async () => {
    await initializeFoods();
    const [storedProfile, storedFoods, storedMeals] = await Promise.all([getSetting<Profile>("profile"), getAll<Food>("foods"), getAll<Meal>("meals")]);
    setProfile(storedProfile || DEFAULT_PROFILE); setFoods(storedFoods); setMeals(storedMeals); setReady(true);
  }, []);
  useEffect(() => {
    // IndexedDB is our external store; hydrate it once when the client mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const params = new URLSearchParams(window.location.search);
    if (params.has("scan")) { setInitialAddView("scan"); setAdding(true); }
    else if (params.has("add")) setAdding(true);
  }, [refresh]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2800); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    const retry = () => { syncIdentityRef.current = ""; setSyncAttempt((value) => value + 1); };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);
  useEffect(() => {
    if (!ready || !auth.ready || !auth.configured) return;
    const identity = auth.user ? `user:${auth.user.id}` : "guest";
    if (syncIdentityRef.current === identity) return;
    syncIdentityRef.current = identity;
    let active = true;
    const synchronize = async () => {
      const owner = await getSetting<string>("dataOwner");
      if (!auth.user) {
        if (owner?.startsWith("user:")) await resetToGuestData();
        else await setSetting("dataOwner", "guest");
        if (active) { setSyncState("local"); await refresh(); }
        return;
      }

      const userId = auth.user.id;
      if (active) setSyncState("syncing");
      const [local, remote, dirty, tombstones] = await Promise.all([
        getLocalSnapshot(),
        getCloudSnapshot(userId),
        getSetting<boolean>(`cloudDirty:${userId}`),
        getSetting<string[]>(`deletedMealIds:${userId}`),
      ]);
      let next;
      let shouldPush = false;
      if (owner === identity && !dirty) {
        next = remote;
      } else if (owner === identity) {
        next = mergeSnapshots(remote, local);
        next.profile = local.profile || remote.profile;
        shouldPush = true;
      } else if (!owner || owner === "guest") {
        next = mergeSnapshots(local, remote);
        shouldPush = true;
      } else {
        next = remote;
      }

      const deletedIds = tombstones || [];
      if (deletedIds.length) {
        const deleted = new Set(deletedIds);
        next.meals = next.meals.filter((meal) => !deleted.has(meal.id));
        await Promise.all(deletedIds.map((id) => deleteCloudMeal(userId, id)));
        await setSetting(`deletedMealIds:${userId}`, []);
        shouldPush = true;
      }
      if (shouldPush) {
        await pushCloudSnapshot(userId, next);
        await setSetting(`cloudDirty:${userId}`, false);
      }
      await replaceLocalSnapshot(next);
      await setSetting("dataOwner", identity);
      if (active) { await refresh(); setSyncState("synced"); }
    };
    synchronize().catch(() => {
      if (active) setSyncState(navigator.onLine ? "error" : "offline");
    });
    return () => { active = false; };
  }, [auth.configured, auth.ready, auth.user, ready, refresh, syncAttempt]);

  const dayMeals = useMemo(() => meals.filter((meal) => localDateKey(new Date(meal.createdAt)) === dateKey).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [meals, dateKey]);
  const syncWrite = (work: (userId: string) => Promise<void>) => {
    if (!auth.user) return;
    const userId = auth.user.id;
    setSyncState("syncing");
    void setSetting(`cloudDirty:${userId}`, true).then(() => work(userId)).then(() => setSyncState("synced")).catch(() => setSyncState(navigator.onLine ? "error" : "offline"));
  };
  const saveProfile = async (next: Profile) => {
    setProfile(next); await setSetting("profile", next); setToast("Targets saved");
    syncWrite((userId) => upsertCloudProfile(userId, next));
  };
  const logMeal = async (meal: Meal, food: Food) => {
    const adjustedDate = dateKey === localDateKey() ? new Date() : new Date(`${dateKey}T12:00:00`);
    const savedMeal = { ...meal, createdAt: adjustedDate.toISOString() };
    await Promise.all([put("meals", savedMeal), put("foods", food)]);
    setMeals((current) => [...current, savedMeal]);
    setFoods((current) => [food, ...current.filter((item) => item.id !== food.id)]);
    setAdding(false); setDirectFood(undefined); setToast(`${food.name} logged`); setTab("today");
    syncWrite(async (userId) => { await Promise.all([upsertCloudMeal(userId, savedMeal), upsertCloudFood(userId, food)]); });
  };
  const deleteMeal = async (id: string) => {
    await remove("meals", id); setMeals((current) => current.filter((meal) => meal.id !== id)); setToast("Meal removed");
    if (auth.user) {
      const key = `deletedMealIds:${auth.user.id}`;
      const current = await getSetting<string[]>(key) || [];
      await setSetting(key, [...new Set([...current, id])]);
      syncWrite(async (userId) => {
        await deleteCloudMeal(userId, id);
        const remaining = (await getSetting<string[]>(key) || []).filter((mealId) => mealId !== id);
        await setSetting(key, remaining);
      });
    }
  };
  const restoreBackup = async (data: { meals?: Meal[]; foods?: Food[]; profile?: Profile }) => {
    await importData(data); await refresh(); setToast("Backup restored");
    if (auth.user) syncWrite(async (userId) => pushCloudSnapshot(userId, await getLocalSnapshot()));
  };
  const openAdd = (view: AddView = "start") => { setInitialAddView(view); setAdding(true); };
  const selectFood = (food: Food) => { setDirectFood(food); setAdding(true); };
  const signOut = async () => { await auth.signOut(); setToast("Signed out · guest mode active"); };

  const syncLabel: Record<SyncState, string> = {
    local: "Private on this device",
    syncing: "Syncing…",
    synced: "Synced privately",
    offline: "Saved offline",
    error: "Sync needs attention",
  };

  if (!ready || !auth.ready) return <div className="app-loading"><span className="brand-mark large">C</span><i /></div>;
  if (!auth.user || auth.passwordRecovery) return <AuthGateway key={auth.passwordRecovery ? "recovery" : "standard"} configured={auth.configured} passwordRecovery={auth.passwordRecovery} onSignIn={auth.signInWithPassword} onSignUp={auth.signUp} onSignInWithProvider={auth.signInWithProvider} onRequestPasswordReset={auth.requestPasswordReset} onUpdatePassword={auth.updatePassword} />;
  return (
    <div className="app-shell">
      <div className="ambient one" /><div className="ambient two" />
      <div className="content-shell">
        {tab === "today" && <TodayView profile={profile} meals={dayMeals} dateKey={dateKey} onDateChange={setDateKey} onAdd={() => openAdd()} onOpenCoach={() => setTab("coach")} onDelete={deleteMeal} syncLabel={auth.user ? syncLabel[syncState] : "Private on this device"} />}
        {tab === "search" && <DiscoverView foods={foods} hideCalories={profile.hideCalories} onSelect={selectFood} onAdd={openAdd} />}
        {tab === "coach" && <CoachView configured={auth.configured} user={auth.user} hideCalories={profile.hideCalories} onOpenAccount={() => setTab("profile")} />}
        {tab === "insights" && <InsightsView meals={meals} profile={profile} />}
        {tab === "profile" && <ProfileView profile={profile} onSave={saveProfile} onImport={restoreBackup} configured={auth.configured} user={auth.user} syncState={auth.user ? syncState : "local"} onSendMagicLink={auth.sendMagicLink} onSignInWithProvider={auth.signInWithProvider} onSignOut={signOut} />}
      </div>
      <BottomNav tab={tab} onChange={setTab} onAdd={() => openAdd()} />
      {adding && <Sheet onClose={() => { setAdding(false); setDirectFood(undefined); }} wide>{directFood ? <PortionSheet food={directFood} hideCalories={profile.hideCalories} onLog={logMeal} onClose={() => { setDirectFood(undefined); setAdding(false); }} /> : <AddFoodSheet foods={foods} hideCalories={profile.hideCalories} initialView={initialAddView} onClose={() => setAdding(false)} onLog={logMeal} />}</Sheet>}
      {!profile.onboardingDone && <div className="onboarding-overlay"><section className="onboarding-card"><TargetEditor profile={profile} onSave={saveProfile} onboarding /></section></div>}
      {toast && <div className="toast"><Check size={17} />{toast}</div>}
    </div>
  );
}
