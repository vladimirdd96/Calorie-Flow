"use client";
/* eslint-disable @next/next/no-img-element -- remote product thumbnails and local camera previews are dynamic user content. */

import {
  ArrowLeft,
  BarChart3,
  Camera,
  Check,
  Copy,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Cloud,
  GripVertical,
  Home,
  Info,
  LogOut,
  LockKeyhole,
  Mail,
  Menu,
  MessageCircle,
  ListChecks,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  ScanLine,
  Search,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  Moon,
  Sun,
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
  replaceData,
  replaceLocalSnapshot,
  setSetting,
  validateBackup,
} from "@/lib/db";
import {
  clearCloudCoachMessages,
  deleteCloudCoachChat,
  deleteCloudMeal,
  getAllCloudCoachMessages,
  getCloudCoachChats,
  getCloudCoachMessages,
  getCloudSnapshot,
  mergeSnapshots,
  pushCloudSnapshot,
  replaceCloudSnapshot,
  saveCloudCoachMessage,
  saveCloudCoachChat,
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
  suggestedMealType,
} from "@/lib/nutrition";
import { findByBarcode, searchOpenFoodFacts } from "@/lib/openfoodfacts";
import { coachMealActionSchema, coachMealChoiceSchema, labelAnalysisSchema, mealPhotoAnalysisSchema } from "@/lib/schemas";
import { getSupabase, type CloudUser, type SocialAuthProvider } from "@/lib/supabase";
import type {
  ActivityLevel,
  CoachChat,
  CoachMealAction,
  CoachMealChoice,
  CoachMessage,
  DietPreset,
  Food,
  GoalMode,
  Meal,
  MealPhotoAnalysis,
  MealType,
  Nutrition,
  Profile,
  ServingUnit,
  Sex,
  WeightEntry,
  WeightTrackingStatus,
} from "@/lib/types";
import { weightTrackingStatuses } from "@/lib/types";
import type { BackupData } from "@/lib/db";

type Tab = "today" | "search" | "coach" | "insights" | "profile";
type ProfileSection = "profile" | "customize";
type AddView = "start" | "search" | "scan" | "label" | "camera" | "photo" | "manual";
type SyncState = "local" | "syncing" | "synced" | "offline" | "error";
type AuthMode = "sign-in" | "register" | "forgot-password" | "update-password";
type CoachSection = "chat" | "groceries";
type GroceryItem = { id: string; name: string; checked: boolean; addedAt: string };
type GroceryList = { id: string; name: string; items: GroceryItem[]; createdAt: string; updatedAt: string };
const themeModes = { light: "light", dark: "dark" } as const;
type ThemeMode = typeof themeModes[keyof typeof themeModes];
const chatTextSizes = { compact: "compact", comfortable: "comfortable", large: "large" } as const;
type ChatTextSize = typeof chatTextSizes[keyof typeof chatTextSizes];

const GROCERY_ITEMS_SETTING = "coach:grocery-items";
const THEME_SETTING = "appearance:theme";
const CHAT_TEXT_SIZE_SETTING = "appearance:chat-text-size";
const HOME_SCREEN_PROMPT_SETTING = "homeScreenPromptCompleted";
const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function isGroceryItem(value: unknown): value is GroceryItem {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.name === "string" && typeof record.checked === "boolean" && typeof record.addedAt === "string";
}

function BrandMark({ large = false }: { large?: boolean }) {
  return <img className={`brand-mark${large ? " large" : ""}`} src="/icon.svg" alt="" aria-hidden="true" />;
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === themeModes.light || value === themeModes.dark;
}

function isChatTextSize(value: unknown): value is ChatTextSize {
  return value === chatTextSizes.compact || value === chatTextSizes.comfortable || value === chatTextSizes.large;
}

function isStandaloneDisplay() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent));
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

export function hideCalorieValues(content: string) {
  return content.replace(/\b\d[\d,.]*\s*(?:-|–|—)?\s*(?:kcal|calories?)\b/gi, "energy hidden");
}


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
  weightEntries: [],
};

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
const compareMealOrder = (a: Meal, b: Meal) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) || a.createdAt.localeCompare(b.createdAt);

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
  custom: { label: "Custom", description: "Set your own daily split" },
};

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
    <div className="progress-ring" role="progressbar" aria-label="Daily calorie progress" aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.round(value)} aria-valuetext={`${Math.round(progress * 100)} percent of daily calories`}>
      <svg viewBox="0 0 200 200" aria-hidden="true">
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

function MiniProgressRing({ value, target, label }: { value: number; target: number; label: string }) {
  const progress = Math.min(1, value / Math.max(1, target));
  return <span className="mini-progress-ring" style={{ "--progress": `${progress * 100}%` } as React.CSSProperties} aria-label={label} />;
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

function FoodAvatar({ food, name }: { food?: Food; name?: string }) {
  if (food?.imageUrl) return <img className="food-avatar" src={food.imageUrl} alt="" />;
  return <div className="food-avatar fallback">{(name || food?.name || "F").slice(0, 1).toUpperCase()}</div>;
}

function MealRow({ meal, onDelete, onEdit, onDuplicate, onDragStart, onDragOver, onDrop, dropPosition, hideCalories }: { meal: Meal; onDelete: () => void; onEdit: () => void; onDuplicate: () => void; onDragStart: (meal: Meal, event: React.DragEvent<HTMLDivElement>) => void; onDragOver: (event: React.DragEvent<HTMLDivElement>) => void; onDrop: (event: React.DragEvent<HTMLDivElement>) => void; dropPosition?: "before" | "after"; hideCalories: boolean }) {
  return (
    <div className={`meal-row ${dropPosition ? `drop-${dropPosition}` : ""}`} draggable onDragStart={(event) => onDragStart(meal, event)} onDragOver={onDragOver} onDrop={onDrop} title="Drag to reorder or move to another meal">
      <span className="meal-drag-handle" aria-hidden="true"><GripVertical size={17} /></span>
      <div className="meal-icon"><Utensils size={17} /></div>
      <div className="meal-copy">
        <strong>{meal.name}</strong>
        <span>{meal.amount} {formatUnit(meal.unit, meal.amount)} · P {meal.nutrition.protein} · C {meal.nutrition.carbs} · F {meal.nutrition.fat}</span>
      </div>
      {!hideCalories && <strong className="meal-kcal"><span>{Math.round(meal.nutrition.calories)}</span><small>kcal</small></strong>}
      <button type="button" className="icon-button ghost" onClick={onEdit} aria-label={`Edit ${meal.name}`}><Pencil size={16} /></button>
      <button type="button" className="icon-button ghost" onClick={onDuplicate} aria-label={`Duplicate ${meal.name}`}><Copy size={16} /></button>
      <button type="button" className="icon-button ghost danger-hover" onClick={onDelete} aria-label={`Delete ${meal.name}`}><Trash2 size={17} /></button>
    </div>
  );
}

function DuplicateMealSheet({ meal, onDuplicate, onClose }: { meal: Meal; onDuplicate: (mealType: MealType) => void; onClose: () => void }) {
  const [mealType, setMealType] = useState<MealType>(meal.mealType);
  return <div className="meal-editor duplicate-meal-sheet"><div className="sheet-header"><div><span className="eyebrow">Your diary</span><h2>Duplicate meal</h2></div></div><div className="duplicate-meal-copy"><strong>{meal.name}</strong><p>Choose where to add a copy. The original meal stays where it is.</p></div><label className="meal-editor-form"><span>Add copy to</span><select value={mealType} onChange={(event) => setMealType(event.target.value as MealType)}>{(Object.keys(mealLabels) as MealType[]).map((type) => <option key={type} value={type}>{mealLabels[type]}</option>)}</select></label><div className="sheet-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="button" className="primary-button" onClick={() => onDuplicate(mealType)}><Copy size={17} />Duplicate</button></div></div>;
}

function MealEditor({ meal, onSave, onClose, hideCalories }: { meal: Meal; onSave: (meal: Meal) => void; onClose: () => void; hideCalories: boolean }) {
  const [name, setName] = useState(meal.name);
  const [amount, setAmount] = useState(String(meal.amount));
  const [mealType, setMealType] = useState<MealType>(meal.mealType);
  const [error, setError] = useState("");
  const surfaceRef = useModalFocus(onClose);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextAmount = Number(amount);
    if (!name.trim() || !Number.isFinite(nextAmount) || nextAmount <= 0) { setError("Add a meal name and a positive amount."); return; }
    const ratio = nextAmount / meal.amount;
    onSave({ ...meal, name: name.trim(), amount: nextAmount, mealType, grams: round(meal.grams * ratio), nutrition: scaleNutrition(meal.nutrition, ratio * 100) });
  };
  return <div ref={surfaceRef as unknown as React.RefObject<HTMLDivElement>} className="meal-editor" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="meal-editor-title">
    <div className="sheet-header"><div><span className="eyebrow">Your diary</span><h2 id="meal-editor-title">Edit meal</h2></div><button className="icon-button ghost" onClick={onClose} aria-label="Close editor"><X /></button></div>
    <form className="meal-editor-form" onSubmit={submit}>
      <label><span>Meal and additions</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={240} /></label>
      <div className="form-grid two"><label><span>Amount</span><input type="number" min="0.1" step="0.1" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label><span>Meal</span><select value={mealType} onChange={(event) => setMealType(event.target.value as MealType)}>{(Object.keys(mealLabels) as MealType[]).map((type) => <option key={type} value={type}>{mealLabels[type]}</option>)}</select></label></div>
      <div className="editor-nutrition"><span className="eyebrow">Current estimate{hideCalories ? " · energy hidden" : ""}</span><div><span>Protein <strong>{round(meal.nutrition.protein * Number(amount || 0) / meal.amount, 1)} g</strong></span><span>Carbs <strong>{round(meal.nutrition.carbs * Number(amount || 0) / meal.amount, 1)} g</strong></span><span>Fat <strong>{round(meal.nutrition.fat * Number(amount || 0) / meal.amount, 1)} g</strong></span>{!hideCalories && <span>Calories <strong>{Math.round(meal.nutrition.calories * Number(amount || 0) / meal.amount)}</strong></span>}</div></div>
      {error && <div className="inline-alert error" role="alert"><Info size={16} />{error}</div>}
      <div className="sheet-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button"><Check size={17} />Save changes</button></div>
    </form>
  </div>;
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

function HomeScreenPrompt({ onDismiss }: { onDismiss: () => void }) {
  return (
    <section className="home-screen-prompt card" aria-labelledby="home-screen-prompt-title">
      <button className="home-screen-prompt-close icon-button ghost" type="button" onClick={onDismiss} aria-label="Dismiss Home Screen tip"><X size={17} /></button>
      <div className="home-screen-prompt-heading">
        <span className="action-icon mint"><Share2 size={19} /></span>
        <div><strong id="home-screen-prompt-title">Keep Calorie Flow close</strong><p>Add it to your Home Screen for one-tap logging, even when you’re offline.</p></div>
      </div>
      <div className="home-screen-prompt-steps"><span><b>1</b>Tap Share</span><span><b>2</b>Choose <strong>Add to Home Screen</strong></span></div>
      <button className="home-screen-prompt-dismiss text-button muted" type="button" onClick={onDismiss}>Not now</button>
    </section>
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
  onEdit,
  onDropMeal,
  onDuplicate,
  syncLabel,
  showHomeScreenPrompt,
  onDismissHomeScreenPrompt,
  onOpenCalendar,
}: {
  profile: Profile;
  meals: Meal[];
  dateKey: string;
  onDateChange: (date: string) => void;
  onAdd: () => void;
  onOpenCoach: () => void;
  onDelete: (id: string) => void;
  onEdit: (meal: Meal) => void;
  onDropMeal: (meal: Meal, mealType: MealType, targetMealId?: string, insertAfter?: boolean) => void;
  onDuplicate: (meal: Meal) => void;
  syncLabel: string;
  showHomeScreenPrompt: boolean;
  onDismissHomeScreenPrompt: () => void;
  onOpenCalendar: () => void;
}) {
  const [dropTarget, setDropTarget] = useState<string>();
  const total = useMemo(() => sumNutrition(meals.map((meal) => meal.nutrition)), [meals]);
  const remaining = Math.max(0, profile.calorieTarget - total.calories);
  const grouped = (Object.keys(mealLabels) as MealType[]).map((type) => ({ type, meals: meals.filter((meal) => meal.mealType === type) }));
  return (
    <main className="page today-page">
      <header className="topbar">
        <div className="brand"><BrandMark /><div><strong>Calorie Flow</strong><small>Simple by default</small></div></div>
        <div className="status-pill"><ShieldCheck size={14} /> {syncLabel}</div>
      </header>

      <div className="date-switcher">
        <button className="icon-button ghost" onClick={() => onDateChange(changeDate(dateKey, -1))} aria-label="Previous day"><ChevronLeft /></button>
        <button className="date-switcher-current" onClick={onOpenCalendar} aria-label={`Open calendar for ${dayLabel(dateKey)}`}><strong>{dayLabel(dateKey)}</strong><span>{new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric" })}</span><ChevronDown size={15} aria-hidden="true" /></button>
        <button className="icon-button ghost" disabled={dateKey >= localDateKey()} onClick={() => onDateChange(changeDate(dateKey, 1))} aria-label="Next day"><ChevronRight /></button>
      </div>

      {showHomeScreenPrompt && <HomeScreenPrompt onDismiss={onDismissHomeScreenPrompt} />}

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
          <MacroBar label="Protein" value={total.protein} target={profile.proteinTarget} color="var(--protein)" />
          <MacroBar label="Carbs" value={total.carbs} target={profile.carbsTarget} color="var(--carbs)" />
          <MacroBar label="Fat" value={total.fat} target={profile.fatTarget} color="var(--fat)" />
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
        {meals.length === 0 ? <EmptyMeals onAdd={onAdd} /> : grouped.map(({ type, meals: groupMeals }) => (
          <div className="meal-group" key={type}>
            <div className="meal-group-title"><span>{mealLabels[type]}</span>{!profile.hideCalories && <span>{Math.round(sumNutrition(groupMeals.map((meal) => meal.nutrition)).calories)} kcal</span>}</div>
            <div className={`meal-list card ${dropTarget === type ? "drop-target" : ""}`} onDragOver={(event) => { event.preventDefault(); setDropTarget(type); }} onDragLeave={() => setDropTarget(undefined)} onDrop={(event) => { event.preventDefault(); const mealId = event.dataTransfer.getData("text/meal-id"); const meal = meals.find((candidate) => candidate.id === mealId); if (meal) onDropMeal(meal, type); setDropTarget(undefined); }}>
              {groupMeals.length ? groupMeals.map((meal) => <MealRow key={meal.id} meal={meal} hideCalories={profile.hideCalories} dropPosition={dropTarget === `${type}:${meal.id}:before` ? "before" : dropTarget === `${type}:${meal.id}:after` ? "after" : undefined} onDelete={() => onDelete(meal.id)} onEdit={() => onEdit(meal)} onDuplicate={() => onDuplicate(meal)} onDragStart={(draggedMeal, event) => { event.dataTransfer.setData("text/meal-id", draggedMeal.id); event.dataTransfer.effectAllowed = "move"; }} onDragOver={(event) => { event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); setDropTarget(`${type}:${meal.id}:${event.clientY < rect.top + rect.height / 2 ? "before" : "after"}`); }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const mealId = event.dataTransfer.getData("text/meal-id"); const draggedMeal = meals.find((candidate) => candidate.id === mealId); if (draggedMeal) { const rect = event.currentTarget.getBoundingClientRect(); onDropMeal(draggedMeal, type, meal.id, event.clientY >= rect.top + rect.height / 2); } setDropTarget(undefined); }} />) : <div className="empty-meal-drop">Drop food here</div>}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

function CalendarSheet({ dateKey, meals, profile, onDateChange, onClose }: { dateKey: string; meals: Meal[]; profile: Profile; onDateChange: (date: string) => void; onClose: () => void }) {
  const selectedDate = new Date(`${dateKey}T12:00:00`);
  const [monthStart, setMonthStart] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 12));
  const today = localDateKey();
  const monthTitle = monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const firstWeekday = (monthStart.getDay() + 6) % 7;
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const calendarDays = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - firstWeekday + 1;
    if (day < 1 || day > daysInMonth) return undefined;
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day, 12);
    return localDateKey(date);
  });
  const totalsByDate = useMemo(() => {
    const totals = new Map<string, Nutrition>();
    meals.forEach((meal) => {
      const key = meal.loggedDate || localDateKey(new Date(meal.createdAt));
      const previous = totals.get(key);
      totals.set(key, previous ? sumNutrition([previous, meal.nutrition]) : meal.nutrition);
    });
    return totals;
  }, [meals]);
  const previousMonth = () => setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1, 12));
  const nextMonth = () => {
    const next = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1, 12);
    if (localDateKey(next) <= today) setMonthStart(next);
  };
  const chooseDate = (key: string) => { onDateChange(key); onClose(); };

  return <div className="calendar-sheet">
    <div className="sheet-header"><div><span className="eyebrow">Your diary</span><h2>Month at a glance</h2></div><button className="icon-button ghost" onClick={onClose} aria-label="Close calendar"><X /></button></div>
    <p className="calendar-intro">Tap a day to jump to its log. Rings show how close you were to your daily guide.</p>
    <div className="calendar-toolbar"><button className="icon-button ghost" onClick={previousMonth} aria-label="Previous month"><ChevronLeft /></button><strong>{monthTitle}</strong><button className="icon-button ghost" onClick={nextMonth} disabled={monthStart.getFullYear() === new Date(`${today}T12:00:00`).getFullYear() && monthStart.getMonth() >= new Date(`${today}T12:00:00`).getMonth()} aria-label="Next month"><ChevronRight /></button></div>
    <div className="calendar-weekdays" aria-hidden="true">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div>
    <div className="calendar-grid" role="grid" aria-label={monthTitle}>
      {calendarDays.map((key, index) => key ? (() => {
        const total = totalsByDate.get(key);
        const isFuture = key > today;
        const isSelected = key === dateKey;
        const progressValue = profile.hideCalories ? total?.protein || 0 : total?.calories || 0;
        const progressTarget = profile.hideCalories ? profile.proteinTarget : profile.calorieTarget;
        return <button key={key} className={`calendar-day ${isSelected ? "selected" : ""} ${total ? "logged" : ""}`} role="gridcell" onClick={() => chooseDate(key)} disabled={isFuture} aria-label={`${new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric" })}${total ? `, ${Math.round(progressValue)} of ${progressTarget} ${profile.hideCalories ? "grams protein" : "calories"}` : ", no meals logged"}`}>
          <span>{new Date(`${key}T12:00:00`).getDate()}</span>{total && <MiniProgressRing value={progressValue} target={progressTarget} label="" />}
        </button>;
      })() : <span className="calendar-day empty" key={`empty-${index}`} aria-hidden="true" />)}
    </div>
    <div className="calendar-legend"><span><i className="legend-ring" /> Logged day</span><span><i className="legend-selected" /> Selected</span>{!profile.hideCalories && <small>Based on {profile.calorieTarget.toLocaleString()} kcal</small>}</div>
  </div>;
}

function FoodRow({ food, onSelect, hideCalories = false }: { food: Food; onSelect: () => void; hideCalories?: boolean }) {
  const detail = food.brand || (food.source === "custom" ? "Your custom food" : food.source === "seed" ? food.servingLabel || "Reference food" : food.source === "food-data-central" ? "USDA FoodData Central" : "Saved food");
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
      <header className="page-header"><span className="eyebrow">Your food shelf</span><h1>Add food your way.</h1><p>Your saved foods and recent meals stay at hand, even when the packaging is long gone.</p></header>
      <button className="search-launch card" onClick={() => onAdd("search")}><Search size={20} /><span>Search foods, brands or barcodes</span><kbd>+</kbd></button>
      <section className="feature-actions">
        <button onClick={() => onAdd("scan")}><span className="action-icon mint"><ScanLine /></span><strong>Scan barcode</strong><small>Package lookup</small></button>
        <button onClick={() => onAdd("camera")}><span className="action-icon blue"><Camera /></span><strong>Read nutrition label</strong><small>Use a package photo</small></button>
        <button onClick={() => onAdd("manual")}><span className="action-icon amber"><Pencil /></span><strong>Add custom food</strong><small>Save foods you make</small></button>
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
        <div className="starter-message"><div><span className="eyebrow">Start your shelf</span><h2>Save the foods you return to.</h2><p>Search, scan, or add a custom food once. It will be ready for a one-tap log next time.</p></div><button className="text-button" onClick={() => onAdd("manual")}><Pencil size={16} />Add custom food</button></div>
        <div className="section-heading"><div><span className="eyebrow">Common starting points</span><h2>Reference foods</h2></div></div>
        <div className="card food-list">{starterFoods.map((food) => <FoodRow key={food.id} food={food} hideCalories={hideCalories} onSelect={() => onSelect(food)} />)}</div>
      </section>}
      <div className="data-credit"><Database size={16} /><span>Packaged-food search by Open Food Facts · ODbL</span></div>
    </main>
  );
}

type WeightPeriod = "week" | "month" | "all";

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  return result;
}

function InsightsView({ meals, profile, onSave, weightTrackingEnabled }: { meals: Meal[]; profile: Profile; onSave: (profile: Profile) => void; weightTrackingEnabled: boolean }) {
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
  const [weightPeriod, setWeightPeriod] = useState<WeightPeriod>("week");
  const entries = [...(profile.weightEntries || [])].sort((a, b) => b.date.localeCompare(a.date));
  const latestWeight = entries[0]?.weightKg ?? profile.weightKg;
  const [weightDate, setWeightDate] = useState(localDateKey());
  const [weightInput, setWeightInput] = useState(String(latestWeight));
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
    const weightKg = Number(weightInput);
    if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 500) return;
    const nextEntries = [...entries.filter((entry) => entry.date !== weightDate), { date: weightDate, weightKg }].sort((a, b) => a.date.localeCompare(b.date));
    onSave({ ...profile, weightKg, weightEntries: nextEntries });
  };
  const removeWeight = (entry: WeightEntry) => onSave({ ...profile, weightEntries: entries.filter((candidate) => candidate.date !== entry.date) });
  return (
    <main className="page">
      <header className="page-header"><span className="eyebrow">No judgement</span><h1>Your rhythm</h1><p>A lightweight view of patterns—not another dashboard to manage.</p></header>
      <section className="summary-strip">
        {!profile.hideCalories && <div className="card"><span>Daily average</span><strong>{Math.round(average).toLocaleString()}</strong><small>kcal on logged days</small></div>}
        <div className="card"><span>Protein average</span><strong>{Math.round(proteinAverage)} g</strong><small>target {profile.proteinTarget} g</small></div>
        {profile.hideCalories && <div className="card"><span>Fibre average</span><strong>{Math.round(loggedDays.length ? loggedDays.reduce((sum, day) => sum + day.total.fiber, 0) / loggedDays.length : 0)} g</strong><small>target {profile.fiberTarget} g</small></div>}
        {weightTrackingEnabled && <div className="card"><span>Weight average</span><strong>{weightAverage ? `${weightAverage.toFixed(1)} kg` : "—"}</strong><small>{weightPeriod === "week" ? "this week" : weightPeriod === "month" ? "this month" : "all time"}</small></div>}
      </section>
      {weightTrackingEnabled && <section className="weight-section" aria-labelledby="weight-heading">
        <div className="section-heading"><div><span className="eyebrow">Optional progress log</span><h2 id="weight-heading">Body weight</h2></div><span className="subtle">{entries.length} {entries.length === 1 ? "entry" : "entries"}</span></div>
        <form className="weight-log card" onSubmit={saveWeight}>
          <div><span className="weight-log-label">Log a weigh-in</span><p>Use the same conditions when you can. Trends are more useful than any single day.</p></div>
          <div className="weight-log-fields"><label><span>Date</span><input type="date" value={weightDate} max={localDateKey()} onChange={(event) => setWeightDate(event.target.value)} /></label><label><span>Weight</span><div className="input-suffix"><input required type="number" inputMode="decimal" min="20" max="500" step="0.1" value={weightInput} onChange={(event) => setWeightInput(event.target.value)} /><span>kg</span></div></label><button className="primary-button" type="submit"><Plus size={17} />Save weight</button></div>
        </form>
        <div className="weight-controls" role="group" aria-label="Weight average period">
          {(Object.entries({ week: "This week", month: "This month", all: "All time" }) as [WeightPeriod, string][]).map(([period, label]) => <button key={period} type="button" className={weightPeriod === period ? "active" : ""} aria-pressed={weightPeriod === period} onClick={() => setWeightPeriod(period)}>{label}</button>)}
        </div>
        <div className="weight-summary-strip">
          <button className="weight-metric card" type="button" onClick={() => setWeightPeriod("week")}><span>Average</span><strong>{weightAverage ? `${weightAverage.toFixed(1)} kg` : "—"}</strong><small>{weightPeriod === "week" ? "this week" : weightPeriod === "month" ? "this month" : "all time"}</small></button>
          <button className="weight-metric card" type="button" onClick={() => setWeightPeriod("all")}><span>Change</span><strong className={weightChange < 0 ? "weight-down" : weightChange > 0 ? "weight-up" : ""}>{periodEntries.length > 1 ? `${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)} kg` : "—"}</strong><small>oldest to latest</small></button>
        </div>
        {groupedWeights.length > 0 ? <div className="weight-history">{groupedWeights.map((group) => {
          const groupAverage = group.entries.reduce((sum, entry) => sum + entry.weightKg, 0) / group.entries.length;
          const label = weightPeriod === "week" ? `Week of ${new Date(`${group.key}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : new Date(`${group.key}-01T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" });
          return <details className="weight-history-group" key={group.key}><summary><span><strong>{label}</strong><small>{group.entries.length} {group.entries.length === 1 ? "weigh-in" : "weigh-ins"}</small></span><b>{groupAverage.toFixed(1)} kg</b></summary><div className="weight-history-entries">{group.entries.map((entry) => <div className="weight-history-entry" key={entry.date}><span>{new Date(`${entry.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span><strong>{entry.weightKg.toFixed(1)} kg</strong><button type="button" className="icon-button subtle-button" onClick={() => removeWeight(entry)} aria-label={`Remove weight logged on ${entry.date}`}><Trash2 size={14} /></button></div>)}</div></details>;
        })}</div> : <div className="weight-empty card"><strong>Your weight history starts here.</strong><p>Log a weigh-in above to see daily entries and rolling averages.</p></div>}
      </section>}
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
        <label><span>Sex</span><select value={draft.sex} onChange={(event) => update("sex", event.target.value as Sex)}><option value="male">Male</option><option value="female">Female</option></select></label>
        <label><span>Age</span><input required type="number" inputMode="numeric" min="16" max="100" value={draft.age} onChange={(event) => update("age", Number(event.target.value))} /></label>
        <label><span>Height</span><div className="input-suffix"><input required type="number" inputMode="decimal" min="120" max="230" value={draft.heightCm} onChange={(event) => update("heightCm", Number(event.target.value))} /><span>cm</span></div></label>
        <label><span>Weight</span><div className="input-suffix"><input required type="number" inputMode="decimal" min="35" max="300" step="0.1" value={draft.weightKg} onChange={(event) => update("weightKg", Number(event.target.value))} /><span>kg</span></div></label>
      </div>
      <label><span>Daily movement</span><select value={draft.activity} onChange={(event) => update("activity", event.target.value as ActivityLevel)}><option value="sedentary">Mostly seated</option><option value="light">Light · 1–2 workouts/week</option><option value="moderate">Moderate · 2–4 workouts/week</option><option value="active">Active · 5–6 workouts/week</option><option value="very-active">Very active · physical work/training</option></select></label>
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
      <div className="chat-text-preference">
        <div><strong>Coach text size</strong><small>Change message density without shrinking buttons or inputs.</small></div>
        <div className="segmented three" role="group" aria-label="Coach text size">
          <button type="button" aria-pressed={chatTextSize === chatTextSizes.compact} className={`text-size-option compact${chatTextSize === chatTextSizes.compact ? " active" : ""}`} onClick={() => onChatTextSizeChange(chatTextSizes.compact)}>Compact</button>
          <button type="button" aria-pressed={chatTextSize === chatTextSizes.comfortable} className={`text-size-option comfortable${chatTextSize === chatTextSizes.comfortable ? " active" : ""}`} onClick={() => onChatTextSizeChange(chatTextSizes.comfortable)}>Comfortable</button>
          <button type="button" aria-pressed={chatTextSize === chatTextSizes.large} className={`text-size-option large${chatTextSize === chatTextSizes.large ? " active" : ""}`} onClick={() => onChatTextSizeChange(chatTextSizes.large)}>Large</button>
        </div>
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
  const [name, setName] = useState(profile.name || accountDisplayName(user) || "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [notice, setNotice] = useState("");
  const fallbackAvatar = providerAvatarUrl(user);
  const visibleAvatar = avatarUrl || fallbackAvatar;
  const initials = (name.trim() || user?.email?.split("@")[0] || "You").slice(0, 1).toUpperCase();

  const save = () => {
    onSave({ ...profile, name: name.trim(), avatarUrl });
    setNotice("Profile saved");
  };
  const chooseAvatar = async (file?: File) => {
    if (!file) return;
    try {
      const nextAvatar = await resizeAvatar(file);
      setAvatarUrl(nextAvatar);
      onSave({ ...profile, name: name.trim(), avatarUrl: nextAvatar });
      setNotice("Photo updated");
    } catch {
      setNotice("That image could not be used. Try another photo.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const removeCustomAvatar = () => {
    setAvatarUrl(undefined);
    onSave({ ...profile, name: name.trim(), avatarUrl: undefined });
    setNotice(fallbackAvatar ? "Using your Google photo again" : "Photo removed");
  };

  return (
    <section className="profile-identity" aria-labelledby="profile-identity-heading">
      <div className="section-heading"><div><span className="eyebrow">About you</span><h2 id="profile-identity-heading">Profile</h2></div></div>
      <div className="profile-identity-editor">
        <button className="avatar-picker" type="button" onClick={() => fileRef.current?.click()} aria-label="Choose a profile photo">
          {visibleAvatar ? <img src={visibleAvatar} alt="" /> : <span>{initials}</span>}
          <i><Upload size={14} /></i>
        </button>
        <div className="profile-identity-fields">
          <label><span>Display name</span><input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label>
          <small>{user ? "Your account photo is used by default. Upload a different one whenever you like." : "Add a name and photo so this diary feels like yours."}</small>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => void chooseAvatar(event.target.files?.[0])} />
      <div className="profile-identity-actions">
        <button className="primary-button" type="button" onClick={save}>Save profile</button>
        {avatarUrl && <button className="text-button muted" type="button" onClick={removeCustomAvatar}>Use default photo</button>}
      </div>
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

function ProfileView({
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
      </div> : <div id="customize-panel" role="tabpanel" aria-labelledby="customize-tab" tabIndex={0}>
        <section className="customize-intro" aria-labelledby="customize-heading"><div><span className="eyebrow">Your preferences</span><h2 id="customize-heading">A calmer tracker, your way</h2><p>These choices only change how Calorie Flow feels and what it shows. Your diary stays private on this device.</p></div></section>
        <DisplayPreferences hideCalories={profile.hideCalories} onChange={(hideCalories) => onSave({ ...profile, hideCalories })} chatTextSize={chatTextSize} onChatTextSizeChange={onChatTextSizeChange} />
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

function Sheet({ children, onClose, wide = false, label = "Sheet", className = "" }: { children: React.ReactNode; onClose: () => void; wide?: boolean; label?: string; className?: string }) {
  const surfaceRef = useModalFocus(onClose);
  const [dragOffset, setDragOffset] = useState(0);
  const dragRef = useRef<{ pointerId: number; startY: number } | undefined>(undefined);
  useEffect(() => {
    document.body.classList.add("sheet-open");
    return () => { document.body.classList.remove("sheet-open"); };
  }, []);
  const dismissOnBackdrop = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };
  const startDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    dragRef.current = { pointerId: event.pointerId, startY: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    setDragOffset(Math.max(0, event.clientY - dragRef.current.startY));
  };
  const endDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    const shouldClose = dragOffset > 90;
    dragRef.current = undefined;
    if (shouldClose) onClose();
    else setDragOffset(0);
  };
  return <div className="sheet-backdrop" onPointerDown={dismissOnBackdrop}><section ref={surfaceRef} className={`sheet ${wide ? "wide" : ""} ${className}`.trim()} style={{ transform: dragOffset ? `translateY(${dragOffset}px)` : undefined, transition: dragOffset ? "none" : "transform .2s ease" }} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}><button className="sheet-handle" type="button" aria-label="Drag down to close" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} /><button className="sheet-close icon-button ghost" type="button" aria-label="Close" onClick={onClose}><X size={18} /></button>{children}</section></div>;
}

function OnboardingDialog({ profile, onSave, onCancel }: { profile: Profile; onSave: (profile: Profile) => void; onCancel?: () => void }) {
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

function WeightTrackingPrompt({ onEnable, onDisable, onDefer }: { onEnable: () => void; onDisable: () => void; onDefer: () => void }) {
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
      <div className="sheet-header"><button className="icon-button ghost" onClick={onClose} aria-label="Back to add food options"><ArrowLeft /></button><div><span className="eyebrow">Package lookup</span><h2>Scan barcode</h2></div><span /></div>
      <div className={`camera-frame ${cameraLive ? "live" : ""}`}>
        <video ref={videoRef} muted playsInline autoPlay />
        {cameraLive ? <><div className="scan-line" /><div className="scan-corners" /></> : <button className="camera-start" onClick={startCamera} disabled={starting}><Camera size={22} /><strong>{starting ? "Opening camera…" : "Open rear camera"}</strong><small>Point it at the barcode</small></button>}
      </div>
      <p className="camera-hint">{cameraLive ? "Hold the barcode inside the frame" : "You’ll be asked to allow camera access."}</p>
      {error && <div className="inline-alert" role="alert"><WifiOff size={17} />{error}</div>}
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

function LabelReader({ onFood, onClose, initialFiles = [], initialAction }: { onFood: (food: Food, questions: string[]) => void; onClose: () => void; initialFiles?: File[]; initialAction?: "camera" | "photo" }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const initialFilesRef = useRef(initialFiles);
  const initialActionRef = useRef(initialAction);
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
      const result = labelAnalysisSchema.parse(body);
      const scannedFood: Food = {
        id: `ai-${crypto.randomUUID()}`,
        name: result.productName || "Scanned label",
        brand: result.brand || undefined,
        barcode: result.barcode || undefined,
        servingGrams: result.servingSizeG || undefined,
        packageGrams: result.packageSizeG || undefined,
        nutrientsPer100: result.per100,
        source: "ai-label",
      };

      // The image reader supplies the nutrition facts; the catalogue can still
      // supply a product thumbnail and cleaner package metadata when the name
      // is recognized, even when no barcode was visible.
      if (result.productName) {
        try {
          const query = [result.brand, result.productName].filter(Boolean).join(" ");
          const match = (await searchOpenFoodFacts(query))[0];
          if (match) {
            onFood({ ...scannedFood, brand: scannedFood.brand || match.brand, imageUrl: match.imageUrl, quantityLabel: match.quantityLabel, barcode: scannedFood.barcode || match.barcode }, result.followUpQuestions);
            return;
          }
        } catch {
          // AI-extracted nutrition remains useful when the optional catalogue is offline.
        }
      }
      onFood(scannedFood, result.followUpQuestions);
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

  const startCamera = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (initialActionRef.current === "camera") void startCamera();
    else if (initialActionRef.current === "photo") inputRef.current?.click();
  }, [startCamera]);

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
    <div className="label-reader">
      <div className="sheet-header"><button className="icon-button ghost" onClick={onClose} aria-label="Back to add food options"><ArrowLeft /></button><div><span className="eyebrow">AI assist</span><h2>Read nutrition label</h2></div><span /></div>
      {cameraLive ? <div className="label-camera-live"><div className="camera-frame live"><video ref={videoRef} muted playsInline autoPlay /><div className="scan-corners" /></div><button className="primary-button full" onClick={capture} disabled={loading}><Camera size={18} />Capture label</button><button className="text-button camera-cancel" onClick={stopCamera}>Cancel camera</button></div> : <div className={`label-dropzone ${previews.length ? "has-preview" : ""}`}>
        {previews.length ? <div className="package-previews">{previews.map((preview) => <img key={preview} src={preview} alt="Selected package detail" />)}</div> : <><span className="action-icon blue"><Camera /></span><strong>Add the package details</strong><small>Label, barcode, and package size work best together</small></>}
        {loading && <span className="analyzing"><i /><strong>Reading the package…</strong></span>}
      </div>}
      {!cameraLive && <div className="label-camera-actions"><button className="primary-button" onClick={startCamera} disabled={starting}><Camera size={18} />{starting ? "Opening camera…" : "Open rear camera"}</button><button className="secondary-button" onClick={() => inputRef.current?.click()}><Upload size={18} />Choose photo</button></div>}
      <input ref={inputRef} className="visually-hidden-file" type="file" accept="image/*" multiple onChange={(event) => analyze(event.target.files || undefined)} />
      {error && <div className="inline-alert error" role="alert"><Info size={17} /><span>{error}</span></div>}
      <div className="label-tips"><strong>For the best result</strong><ul><li>Add up to three details: nutrition table, barcode, and package size.</li><li>One photo is fine when it has everything.</li><li>You’ll confirm the amount and meal before anything is logged.</li></ul></div>
    </div>
  );
}

function MealPhotoReader({ onMeal, onClose }: { onMeal: (analysis: MealPhotoAnalysis) => void; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const analyze = async (file?: File) => {
    if (!file) return;
    setError(""); setLoading(true);
    try {
      const image = await imageToDataUrl(file); setPreview(image);
      const token = (await getSupabase()?.auth.getSession())?.data.session?.access_token;
      const response = await fetch("/api/analyze-meal-photo", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ image }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The meal photo could not be understood.");
      onMeal(mealPhotoAnalysisSchema.parse(body));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The meal photo could not be understood."); }
    finally { setLoading(false); }
  };
  useEffect(() => { inputRef.current?.click(); }, []);
  return <div className="meal-photo-reader">
    <div className="sheet-header"><button className="icon-button ghost" onClick={onClose} aria-label="Back to Coach"><ArrowLeft /></button><div><span className="eyebrow">AI assist</span><h2>Understand a meal photo</h2></div><span /></div>
    <div className={`label-dropzone ${preview ? "has-preview" : ""}`}>{preview ? <img className="meal-photo-preview" src={preview} alt="Photo selected for meal analysis" /> : <><span className="action-icon mint"><Camera /></span><strong>Choose any food photo</strong><small>Meal screenshots, plated food, menus, or recipes all work</small></>}{loading && <span className="analyzing"><i /><strong>Understanding the meal…</strong></span>}</div>
    <input ref={inputRef} className="visually-hidden-file" type="file" accept="image/*" onChange={(event) => void analyze(event.target.files?.[0])} />
    <button className="secondary-button full" type="button" onClick={() => inputRef.current?.click()} disabled={loading}><Upload size={18} />Choose a different photo</button>
    {error && <div className="inline-alert error" role="alert"><Info size={17} /><span>{error}</span></div>}
    <p className="photo-disclaimer">The result is an estimate. You’ll review the meal, amount, and meal type before it is saved.</p>
  </div>;
}

function ManualFood({ initialBarcode, notice, onSave, onClose, hideCalories }: { initialBarcode?: string; notice?: string; onSave: (food: Food) => void; onClose: () => void; hideCalories: boolean }) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [barcode, setBarcode] = useState(initialBarcode || "");
  const [servingGrams, setServingGrams] = useState(100);
  const [nutrition, setNutrition] = useState<Nutrition>({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 });
  const [error, setError] = useState("");
  const updateNutrition = (key: keyof Nutrition, value: string) => setNutrition((current) => ({ ...current, [key]: Number(value) }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const calories = hideCalories ? round(nutrition.protein * 4 + nutrition.carbs * 4 + nutrition.fat * 9, 0) : nutrition.calories;
    const values = [...Object.values(nutrition), calories, servingGrams];
    if (!name.trim() || values.some((value) => !Number.isFinite(value) || value < 0) || servingGrams <= 0) {
      setError("Add a food name and use zero or positive nutrition values with a serving above zero.");
      return;
    }
    setError("");
    onSave({ id: `custom-${crypto.randomUUID()}`, name: name.trim(), brand: brand.trim() || undefined, barcode: barcode.trim() || undefined, servingGrams, nutrientsPer100: { ...nutrition, calories }, source: "custom" });
  };
  return (
    <form className="sheet-form manual-food-form" onSubmit={submit}>
      <div className="sheet-header"><button type="button" className="icon-button ghost" onClick={onClose} aria-label="Back to add food options"><ArrowLeft /></button><div><span className="eyebrow">Full control</span><h2>Custom food</h2></div><span /></div>
      {notice && <div className="inline-alert" role="status"><Info size={17} /><span>{notice}</span></div>}
      <div className="form-grid two"><label className="span-two"><span>Food name</span><input autoFocus required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Homemade meatballs" /></label><label><span>Brand <small>optional</small></span><input maxLength={120} value={brand} onChange={(event) => setBrand(event.target.value)} /></label><label><span>Barcode <small>optional</small></span><input inputMode="numeric" maxLength={80} value={barcode} onChange={(event) => setBarcode(event.target.value)} /></label></div>
      <div className="nutrition-entry"><div className="entry-heading"><div><strong>Nutrition per 100 g</strong><small>{hideCalories ? "Energy is calculated quietly from macros" : "Copy the package values"}</small></div><Package size={20} /></div><div className="form-grid three">{!hideCalories && <label><span>Calories</span><input required min="0" type="number" inputMode="decimal" value={nutrition.calories} onChange={(event) => updateNutrition("calories", event.target.value)} /></label>}<label><span>Protein</span><input min="0" type="number" inputMode="decimal" step="0.1" value={nutrition.protein} onChange={(event) => updateNutrition("protein", event.target.value)} /></label><label><span>Carbs</span><input min="0" type="number" inputMode="decimal" step="0.1" value={nutrition.carbs} onChange={(event) => updateNutrition("carbs", event.target.value)} /></label><label><span>Fat</span><input min="0" type="number" inputMode="decimal" step="0.1" value={nutrition.fat} onChange={(event) => updateNutrition("fat", event.target.value)} /></label><label><span>Fibre</span><input min="0" type="number" inputMode="decimal" step="0.1" value={nutrition.fiber} onChange={(event) => updateNutrition("fiber", event.target.value)} /></label><label><span>Sugar</span><input min="0" type="number" inputMode="decimal" step="0.1" value={nutrition.sugar} onChange={(event) => updateNutrition("sugar", event.target.value)} /></label></div></div>
      <label><span>Default serving weight</span><div className="input-suffix"><input required type="number" inputMode="decimal" min="0.1" step="0.1" value={servingGrams} onChange={(event) => setServingGrams(Number(event.target.value))} /><span>g</span></div></label>
      {error && <div className="inline-alert error" role="alert"><Info size={17} /><span>{error}</span></div>}
      <button className="primary-button full" type="submit">Continue to amount<ChevronRight size={18} /></button>
    </form>
  );
}

function PortionSheet({ food, questions, onLog, onClose, hideCalories }: { food: Food; questions?: string[]; onLog: (meal: Meal, food: Food) => void; onClose: () => void; hideCalories: boolean }) {
  const units = contextualUnits(food);
  const initialUnit: ServingUnit = food.packageGrams ? "package" : food.servingGrams ? "serving" : "g";
  const [unit, setUnit] = useState<ServingUnit>(initialUnit);
  const [amount, setAmount] = useState(initialUnit === "g" ? 100 : 1);
  const [mealType, setMealType] = useState<MealType>(() => suggestedMealType());
  const [loggedDate, setLoggedDate] = useState(localDateKey());
  const grams = gramsFor(food, amount, unit);
  const nutrition = scaleNutrition(food.nutrientsPer100, grams);
  const log = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(grams) || grams <= 0) return;
    onLog({
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
    loggedDate,
    source: food.source,
    estimated: food.source === "ai-label" || !food.verified,
    }, { ...food, lastUsedAt: new Date().toISOString() });
  };
  return (
    <form className="portion-sheet" onSubmit={log}>
      <div className="sheet-header"><button type="button" className="icon-button ghost" onClick={onClose} aria-label="Back to food selection"><ArrowLeft /></button><div><span className="eyebrow">Confirm amount</span><h2>Log food</h2></div><span /></div>
      <div className="selected-food"><FoodAvatar food={food} /><div><strong>{food.name}</strong><span>{food.brand || food.quantityLabel || "Nutrition per 100 g"}</span></div>{!hideCalories && <div className="selected-calories"><strong>{nutrition.calories}</strong><small>kcal</small></div>}</div>
      {!!questions?.length && <div className="follow-up"><Sparkles size={18} /><div><strong>One detail still matters</strong>{questions.map((question) => <p key={question}>{question}</p>)}<small>Use grams below if the package or serving amount is unknown.</small></div></div>}
      <div className="amount-control"><button type="button" aria-label="Decrease amount" onClick={() => setAmount(Math.max(unit === "g" ? 1 : 0.25, round(amount - (unit === "g" || unit === "ml" ? 10 : 0.5), 2)))}>−</button><label><input required aria-label="Amount" type="number" inputMode="decimal" min="0.01" step="any" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /><span>{formatUnit(unit, amount)}</span></label><button type="button" aria-label="Increase amount" onClick={() => setAmount(round(amount + (unit === "g" || unit === "ml" ? 10 : 0.5), 2))}>+</button></div>
      <div className="unit-scroll" role="group" aria-label="Serving unit">{units.map((option) => <button type="button" key={option} aria-pressed={unit === option} className={unit === option ? "active" : ""} onClick={() => { setUnit(option); setAmount(option === "g" || option === "ml" ? 100 : 1); }}>{unitLabels[option]}</button>)}</div>
      {(unit === "tbsp" || unit === "tsp" || unit === "ml") && <p className="estimate-note"><Info size={14} /> Volume-to-weight conversion is approximate unless the food provides it.</p>}
      <div className="nutrition-preview"><div><span>Protein</span><strong>{nutrition.protein} g</strong></div><div><span>Carbs</span><strong>{nutrition.carbs} g</strong></div><div><span>Fat</span><strong>{nutrition.fat} g</strong></div><div><span>Fibre</span><strong>{nutrition.fiber} g</strong></div></div>
      <div className="portion-action-area">
        <div className="field-block"><span id="meal-type-label">Add to</span><div className="segmented four" role="group" aria-labelledby="meal-type-label">{(Object.keys(mealLabels) as MealType[]).map((type) => <button type="button" key={type} aria-pressed={mealType === type} className={mealType === type ? "active" : ""} onClick={() => setMealType(type)}>{mealLabels[type]}</button>)}</div></div>
      <label className="meal-date-field"><span>Meal date</span><input type="date" value={loggedDate} max={localDateKey()} onChange={(event) => setLoggedDate(event.target.value || localDateKey())} /></label>
      <div className="portion-submit"><button className="primary-button full" type="submit"><Plus size={18} />{hideCalories ? "Log food" : `Log ${nutrition.calories} kcal`}</button><p className="form-footnote">{grams} g total · {food.source === "open-food-facts" ? "Open Food Facts" : food.source === "food-data-central" ? "USDA FoodData Central" : food.source === "ai-label" ? "AI-extracted—check the package" : food.source === "custom" ? "Your custom food" : "Generic reference value"}</p></div>
      </div>
    </form>
  );
}

function AddFoodSheet({ foods, initialView = "start", onClose, onLog, onMealPhoto, hideCalories }: { foods: Food[]; initialView?: AddView; onClose: () => void; onLog: (meal: Meal, food: Food) => void; onMealPhoto: (analysis: MealPhotoAnalysis) => void; hideCalories: boolean }) {
  const [view, setView] = useState<AddView>(initialView);
  const [selected, setSelected] = useState<Food>();
  const [questions, setQuestions] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [intakeError, setIntakeError] = useState("");
  const [manualNotice, setManualNotice] = useState("");
  const [unknownBarcode, setUnknownBarcode] = useState("");
  const [intakeDraft, setIntakeDraft] = useState("");
  const [coachReply, setCoachReply] = useState("");
  const [askingCoach, setAskingCoach] = useState(false);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const searchRequestRef = useRef(0);
  const recent = [...foods].filter((food) => food.lastUsedAt).sort((a, b) => (b.lastUsedAt || "").localeCompare(a.lastUsedAt || "")).slice(0, 6);
  const changeView = (nextView: AddView) => {
    if (view === "search" && nextView !== "search") {
      searchRequestRef.current += 1;
      setLoading(false);
      setSearchError("");
    }
    if (nextView !== "start") setIntakeError("");
    if (nextView !== "manual") {
      setUnknownBarcode("");
      setManualNotice("");
    }
    setView(nextView);
  };
  const pick = (food: Food, followUps: string[] = []) => { setSearchError(""); setSelected(food); setQuestions(followUps); };
  const runSearch = useCallback(async (value: string) => {
    const requestId = ++searchRequestRef.current;
    const normalized = value.trim().toLowerCase();
    if (!normalized) { setResults([]); setSearchError(""); setLoading(false); return; }
    const local = foods.filter((food) => `${food.name} ${food.brand || ""} ${food.barcode || ""}`.toLowerCase().includes(normalized)).slice(0, 10);
    setResults(local); setLoading(true); setSearchError("");
    if (normalized.length < 2) { setLoading(false); return; }
    try {
      const remote = await searchOpenFoodFacts(value.trim());
      if (requestId !== searchRequestRef.current) return;
      const localIds = new Set(local.map((food) => food.id));
      setResults([...local, ...remote.filter((food) => !localIds.has(food.id))].slice(0, 25));
    } catch {
      if (requestId === searchRequestRef.current && !local.length) setSearchError("Online food search is unavailable. You can still add a custom food.");
    } finally {
      if (requestId === searchRequestRef.current) setLoading(false);
    }
  }, [foods]);
  const search = async (event?: FormEvent) => { event?.preventDefault(); await runSearch(query); };
  useEffect(() => {
    if (view !== "search") return;
    const timer = window.setTimeout(() => { void runSearch(query); }, 700);
    return () => window.clearTimeout(timer);
  }, [query, runSearch, view]);
  const sendIntake = async (event: FormEvent) => {
    event.preventDefault();
    const message = intakeDraft.trim();
    if (!message || askingCoach) return;
    const soundsConversational = /\b(i|my|me|how|what|can|should|help|ate|eaten|bite|bites|slice|slices|calorie|protein|macro|portion)\b|[?]/i.test(message);
    setCoachReply(""); setIntakeError("");
    if (!soundsConversational) {
      setQuery(message); changeView("search"); await runSearch(message);
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
      const body: unknown = await response.json();
      const bodyRecord = body && typeof body === "object" ? body as Record<string, unknown> : {};
      if (!response.ok) throw new Error(typeof bodyRecord.error === "string" ? bodyRecord.error : "The Coach is unavailable right now.");
      if (typeof bodyRecord.reply !== "string") throw new Error("The Coach returned an invalid response.");
      setCoachReply(hideCalories ? hideCalorieValues(bodyRecord.reply) : bodyRecord.reply);
    } catch (caught) {
      setIntakeError(caught instanceof Error ? caught.message : "The Coach is unavailable right now.");
    } finally { setAskingCoach(false); }
  };
  const addImages = (files?: FileList | File[]) => {
    if (!files?.length) return;
    setPendingImages(Array.from(files).slice(0, 3));
    changeView("label");
  };
  const barcode = async (code: string, fallback?: Food, followUps: string[] = []) => {
    setLoading(true); setManualNotice("");
    const cached = foods.find((food) => food.barcode === code);
    if (cached) { setLoading(false); pick(cached, followUps); return; }
    try {
      const food = await findByBarcode(code);
      if (food) pick(food, followUps);
      else if (fallback) pick(fallback, followUps);
      else { setUnknownBarcode(code); setManualNotice("No product matched this barcode. Add the name and nutrition from the package to save it on this device."); changeView("manual"); }
    } catch {
      if (fallback) pick(fallback, followUps);
      else { setUnknownBarcode(code); setManualNotice("We couldn’t look up this barcode right now. Add the name and nutrition from the package to save it on this device."); changeView("manual"); }
    }
    finally { setLoading(false); }
  };
  if (selected) return <PortionSheet food={selected} questions={questions} hideCalories={hideCalories} onLog={onLog} onClose={() => setSelected(undefined)} />;
  if (view === "scan") return <>{loading && <div className="global-loader"><i />Looking up product…</div>}<BarcodeScanner onResult={barcode} onClose={() => changeView("start")} /></>;
  if (view === "camera") return <LabelReader initialFiles={pendingImages} initialAction="camera" onFood={(food, followUps) => { if (food.barcode) void barcode(food.barcode, food, followUps); else pick(food, followUps); }} onClose={() => { setPendingImages([]); changeView("start"); }} />;
  if (view === "photo") return <MealPhotoReader onMeal={onMealPhoto} onClose={() => changeView("start")} />;
  if (view === "label") return <LabelReader initialFiles={pendingImages} onFood={(food, followUps) => { if (food.barcode) void barcode(food.barcode, food, followUps); else pick(food, followUps); }} onClose={() => { setPendingImages([]); changeView("start"); }} />;
  if (view === "manual") return <ManualFood initialBarcode={unknownBarcode} notice={manualNotice} hideCalories={hideCalories} onSave={pick} onClose={() => changeView("start")} />;
  if (view === "search") return (
    <div>
      <div className="sheet-header"><button className="icon-button ghost" onClick={() => changeView("start")} aria-label="Back to add food options"><ArrowLeft /></button><div><span className="eyebrow">Food database</span><h2>Search</h2></div><button className="icon-button ghost" onClick={onClose} aria-label="Close add food"><X /></button></div>
      <form className="sheet-search" onSubmit={search}><Search size={19} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Food, brand or barcode" /><button type="submit">Search now</button></form>
      {loading && <div className="search-status" role="status"><i />Searching local and packaged foods…</div>}
      {searchError && <div className="inline-alert" role="alert"><WifiOff size={17} />{searchError}</div>}
      <div className="food-list sheet-food-list">{results.map((food) => <FoodRow key={food.id} food={food} hideCalories={hideCalories} onSelect={() => pick(food)} />)}</div>
      {!loading && query && results.length === 0 && <div className="search-empty"><Database /><strong>No match yet</strong><p>Add it as a custom food and it will be ready next time.</p><button className="secondary-button" onClick={() => changeView("manual")}>Add custom food</button></div>}
      {!query && <div className="quick-list"><span className="eyebrow">Try something simple</span>{foods.slice(0, 6).map((food) => <FoodRow key={food.id} food={food} hideCalories={hideCalories} onSelect={() => pick(food)} />)}</div>}
      <div className="data-credit"><Database size={15} /><span>Product results by Open Food Facts · ODbL</span></div>
    </div>
  );
  return (
    <div className="coach-intake" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addImages(event.dataTransfer.files); }}>
      <div className="sheet-header"><button className="icon-button ghost" onClick={onClose} aria-label="Close add food"><X /></button><div><span className="eyebrow">Log with Coach</span><h2>Add food or get help</h2></div><span /></div>
      <div className="intake-actions"><button onClick={() => changeView("scan")}><ScanLine size={17} />Barcode</button><button onClick={() => { setPendingImages([]); changeView("camera"); }}><Camera size={17} />Take photo</button><button onClick={() => imageInputRef.current?.click()}><Upload size={17} />Add photos</button></div>
      <input ref={imageInputRef} className="visually-hidden-file" type="file" accept="image/*" capture="environment" multiple onChange={(event) => addImages(event.target.files || undefined)} />
      <label className="intake-input-label" htmlFor="coach-intake">Search a food or ask Coach</label>
      <form className="intake-composer" onSubmit={sendIntake}><input id="coach-intake" autoFocus value={intakeDraft} onChange={(event) => setIntakeDraft(event.target.value)} placeholder="Food or question" /><button type="submit" disabled={!intakeDraft.trim() || askingCoach} aria-label="Send to Coach">{askingCoach ? <span className="coach-loader" /> : <Send />}</button></form>
      {coachReply && <div className="intake-reply"><span>Coach</span><p>{coachReply}</p><button className="text-button" onClick={() => { setQuery(intakeDraft); changeView("search"); void runSearch(intakeDraft); }}><Search size={16} />Find a food to log</button></div>}
      {intakeError && <div className="inline-alert error" role="alert"><Info size={17} />{intakeError}</div>}
      {!!recent.length && <div className="quick-list"><span className="eyebrow">Recent · one tap</span>{recent.map((food) => <FoodRow key={food.id} food={food} hideCalories={hideCalories} onSelect={() => pick(food)} />)}</div>}
      <button className="text-button intake-manual" onClick={() => changeView("manual")}><Pencil size={16} />Add custom food</button>
      <div className="simple-note"><ShieldCheck size={17} /><span>Barcode and saved-food search work directly. Package photos are sent to AI only after you add them.</span></div>
    </div>
  );
}

type DisplayCoachMessage = CoachMessage & { imageUrl?: string; sources?: Array<{ title: string; url: string }>; mealAction?: CoachMealAction; mealChoices?: CoachMealChoice[] };

function groceryItemsFromReply(content: string) {
  const section = content.match(/(?:^|\n)\s*(?:\*\*)?grocery list(?:\*\*)?\s*:?\s*\n([\s\S]*)/i)?.[1];
  if (!section) return [];
  return section.split("\n")
    .map((line) => line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.+?)\s*$/)?.[1]?.replace(/\*\*/g, "").trim())
    .filter((item): item is string => Boolean(item))
    .slice(0, 24);
}

function titleFromQuestion(question: string) {
  const normalized = question.replace(/\s+/g, " ").trim();
  const firstSentence = normalized.split(/(?<=[.!?])\s+/)[0] || normalized;
  return firstSentence.length > 54 ? `${firstSentence.slice(0, 53).trimEnd()}…` : firstSentence;
}

function CoachView({ configured, user, onOpenAccount, onOpenAdd, onLogCoachMeal, hideCalories, chatTextSize }: { configured: boolean; user: CloudUser | null; onOpenAccount: () => void; onOpenAdd: (view: AddView) => void; onLogCoachMeal: (action: CoachMealAction) => Promise<void>; hideCalories: boolean; chatTextSize: ChatTextSize }) {
  const [messages, setMessages] = useState<DisplayCoachMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadedUserId, setLoadedUserId] = useState("");
  const [historyAttempt, setHistoryAttempt] = useState(0);
  const [chats, setChats] = useState<CoachChat[]>([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [section, setSection] = useState<CoachSection>("chat");
  const [groceryLists, setGroceryLists] = useState<GroceryList[]>([]);
  const [activeGroceryListId, setActiveGroceryListId] = useState("");
  const [loadedGroceryKey, setLoadedGroceryKey] = useState("");
  const [groceryDraft, setGroceryDraft] = useState("");
  const [groceryListDraft, setGroceryListDraft] = useState("");
  const [groceryModal, setGroceryModal] = useState<"choose" | "manage" | null>(null);
  const [pendingGroceries, setPendingGroceries] = useState<string[]>([]);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [loggedChoiceLabels, setLoggedChoiceLabels] = useState<string[]>([]);
  const coachImageInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const grocerySettingKey = user ? `${GROCERY_ITEMS_SETTING}:${user.id}` : undefined;
  useEffect(() => {
    let active = true;
    if (!grocerySettingKey) return () => { active = false; };
    getSetting<unknown>(grocerySettingKey)
      .then((stored) => {
        if (!active) return;
        const now = new Date().toISOString();
        const lists = Array.isArray(stored) && stored.every((value) => value && typeof value === "object" && "items" in value)
          ? stored.flatMap((value) => {
            const record = value as Record<string, unknown>;
            if (typeof record.id !== "string" || typeof record.name !== "string" || !Array.isArray(record.items)) return [];
            return [{ id: record.id, name: record.name, items: record.items.filter(isGroceryItem), createdAt: typeof record.createdAt === "string" ? record.createdAt : now, updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : now }];
          })
          : [{ id: crypto.randomUUID(), name: "My groceries", items: Array.isArray(stored) ? stored.filter(isGroceryItem) : [], createdAt: now, updatedAt: now }];
        const available = lists.length ? lists : [{ id: crypto.randomUUID(), name: "My groceries", items: [], createdAt: now, updatedAt: now }];
        setGroceryLists(available); setActiveGroceryListId(available[0].id); setLoadedGroceryKey(grocerySettingKey);
        void setSetting(grocerySettingKey, available);
      })
      .catch(() => {
        if (!active) return;
        const now = new Date().toISOString();
        const fallback = { id: crypto.randomUUID(), name: "My groceries", items: [], createdAt: now, updatedAt: now };
        setGroceryLists([fallback]); setActiveGroceryListId(fallback.id); setLoadedGroceryKey(grocerySettingKey);
      });
    return () => { active = false; };
  }, [grocerySettingKey]);

  useEffect(() => {
    let active = true;
    if (!user) return;
    getCloudCoachChats(user.id).then(async (storedChats) => {
      if (!active) return;
      let available = storedChats;
      if (!available.length) {
        const now = new Date().toISOString();
        const chat: CoachChat = { id: crypto.randomUUID(), title: "New conversation", createdAt: now, updatedAt: now };
        await saveCloudCoachChat(user.id, chat); available = [chat];
      }
      const chat = available[0];
      const stored = await getCloudCoachMessages(user.id, chat.id);
      if (active) { setChats(available); setActiveChatId(chat.id); setMessages(stored); setLoadedUserId(user.id); }
    }).catch(() => {
      if (active) {
        const now = new Date().toISOString();
        const fallback: CoachChat = { id: `local-${user.id}`, title: "New conversation", createdAt: now, updatedAt: now };
        setChats([fallback]); setActiveChatId(fallback.id); setMessages([]); setLoadedUserId(user.id);
        setError("Coach history could not be loaded. You can still start a new conversation, or retry loading it.");
      }
    });
    return () => { active = false; };
  }, [historyAttempt, user]);
  useEffect(() => {
    if (!user) return;
    const supabase = getSupabase();
    if (!supabase) return;
    let active = true;
    const refreshActiveChat = async () => {
      if (!active || !activeChatId) return;
      try {
        const stored = await getCloudCoachMessages(user.id, activeChatId);
        if (active) setMessages(stored);
      } catch {
        // Realtime is an enhancement; offline/local behavior remains available.
      }
    };
    const refreshChats = async () => {
      try {
        const storedChats = await getCloudCoachChats(user.id);
        if (!active) return;
        setChats(storedChats);
        if (activeChatId && !storedChats.some((chat) => chat.id === activeChatId)) {
          const nextChat = storedChats[0];
          setActiveChatId(nextChat?.id || "");
          setMessages(nextChat ? await getCloudCoachMessages(user.id, nextChat.id) : []);
        }
      } catch {
        // Realtime is an enhancement; offline/local behavior remains available.
      }
    };
    const channel = supabase
      .channel(`coach-sync:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "coach_chats", filter: `user_id=eq.${user.id}` }, () => { void refreshChats(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "coach_messages", filter: `user_id=eq.${user.id}` }, () => { void refreshActiveChat(); })
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [activeChatId, user]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, loading]);

  const send = async (suggestion?: string) => {
    const image = suggestion ? undefined : attachedImage;
    const content = (suggestion ?? draft).trim() || (image ? "Please take a look at this photo." : "");
    if (!content || !user || loading || loadedUserId !== user.id) return;
    if (!activeChatId) return;
    const userMessage: DisplayCoachMessage = { id: crypto.randomUUID(), chatId: activeChatId, role: "user", content, createdAt: new Date().toISOString(), ...(image ? { imageUrl: image } : {}) };
    const history = messages.slice(-12).map(({ role, content: previous }) => ({ role, content: previous }));
    const activeChat = chats.find((chat) => chat.id === activeChatId);
    if (activeChat?.title === "New conversation" && messages.length === 0) {
      const titledChat = { ...activeChat, title: titleFromQuestion(content), updatedAt: userMessage.createdAt };
      setChats((current) => current.map((chat) => chat.id === titledChat.id ? titledChat : chat));
      try { await saveCloudCoachChat(user.id, titledChat); } catch { setError("Your question was sent, but the chat title could not be saved yet."); }
    }
    setMessages((current) => [...current, userMessage]); setDraft(""); setAttachedImage(null); setError(""); setLoading(true);
    try {
      try { await saveCloudCoachMessage(user.id, userMessage); } catch { setError("This reply will continue, but cloud history is temporarily unavailable."); }
      const session = await getSupabase()?.auth.getSession();
      const token = session?.data.session?.access_token;
      if (!token) throw new Error("Your session expired. Please sign in again.");
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: content,
          ...(image ? { image } : {}),
          history,
          localDate: localDateKey(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const body: unknown = await response.json();
      const bodyRecord = body && typeof body === "object" ? body as Record<string, unknown> : {};
      if (!response.ok) throw new Error(typeof bodyRecord.error === "string" ? bodyRecord.error : "The Coach is unavailable right now.");
      if (typeof bodyRecord.reply !== "string") throw new Error("The Coach returned an invalid response.");
      const mealActionResult = coachMealActionSchema.safeParse(bodyRecord.mealAction);
      const mealChoices = Array.isArray(bodyRecord.mealChoices) ? bodyRecord.mealChoices.flatMap((choice) => {
        const parsed = coachMealChoiceSchema.safeParse(choice);
        return parsed.success ? [parsed.data] : [];
      }) : [];
      const sources = Array.isArray(bodyRecord.sources) ? bodyRecord.sources.flatMap((source) => {
        if (!source || typeof source !== "object") return [];
        const record = source as Record<string, unknown>;
        return typeof record.title === "string" && typeof record.url === "string" ? [{ title: record.title, url: record.url }] : [];
      }).slice(0, 6) : undefined;
      const assistantMessage: DisplayCoachMessage = {
        id: crypto.randomUUID(),
        chatId: activeChatId,
        role: "assistant",
        content: hideCalories ? hideCalorieValues(bodyRecord.reply) : bodyRecord.reply,
        createdAt: new Date().toISOString(),
        sources,
        ...(mealActionResult.success ? { mealAction: mealActionResult.data } : {}),
        ...(mealChoices.length ? { mealChoices } : {}),
      };
      setMessages((current) => [...current, assistantMessage]);
      try { await saveCloudCoachMessage(user.id, assistantMessage); } catch { setError("Reply received. Cloud history is temporarily unavailable."); }
      if (mealActionResult.success) {
        try { await onLogCoachMeal(mealActionResult.data); } catch { setError("The Coach found the meal, but it could not be saved yet. Please try again."); }
      }
    } catch (caught) {
      if (image) setAttachedImage(image);
      setError(caught instanceof Error ? caught.message : "The Coach is unavailable right now.");
    } finally { setLoading(false); }
  };
  const logChoice = async (choice: CoachMealChoice) => {
    if (loggedChoiceLabels.includes(choice.label)) return;
    try {
      await onLogCoachMeal(choice.meal);
      setLoggedChoiceLabels((current) => [...current, choice.label]);
    } catch { setError("The meal could not be saved yet. Please try again."); }
  };
  const clear = async () => {
    if (!user || !messages.length) return;
    if (!window.confirm("Clear your private Coach conversation? This cannot be undone.")) return;
    await clearCloudCoachMessages(user.id, activeChatId);
    setMessages([]);
  };
  const switchChat = async (chatId: string) => {
    if (!user || chatId === activeChatId) return;
    setActiveChatId(chatId); setMessages([]);
    try { setMessages(await getCloudCoachMessages(user.id, chatId)); } catch { setError("This conversation could not be loaded."); }
  };
  const newChat = async () => {
    if (!user) return;
    const now = new Date().toISOString();
    const chat: CoachChat = { id: crypto.randomUUID(), title: "New conversation", createdAt: now, updatedAt: now };
    await saveCloudCoachChat(user.id, chat); setChats((current) => [chat, ...current]); setActiveChatId(chat.id); setMessages([]);
  };
  const beginRename = (chat: CoachChat) => {
    setRenamingChatId(chat.id);
    setRenameDraft(chat.title);
  };
  const saveRename = async () => {
    if (!user || !renamingChatId) return;
    const title = renameDraft.trim();
    if (!title) return;
    const chat = chats.find((candidate) => candidate.id === renamingChatId);
    if (!chat) return;
    const renamedChat = { ...chat, title: title.slice(0, 120), updatedAt: new Date().toISOString() };
    setChats((current) => current.map((candidate) => candidate.id === renamedChat.id ? renamedChat : candidate));
    setRenamingChatId(null);
    try { await saveCloudCoachChat(user.id, renamedChat); } catch { setError("The chat was renamed here, but the new name could not be synced yet."); }
  };
  const removeChat = async () => {
    if (!user || chats.length < 2 || !window.confirm("Delete this conversation? This cannot be undone.")) return;
    await deleteCloudCoachChat(user.id, activeChatId);
    const remaining = chats.filter((chat) => chat.id !== activeChatId);
    setChats(remaining); setActiveChatId(remaining[0].id); setMessages(await getCloudCoachMessages(user.id, remaining[0].id));
  };
  const updateGroceryLists = (updater: (current: GroceryList[]) => GroceryList[]) => {
    setGroceryLists((current) => {
      const next = updater(loadedGroceryKey === grocerySettingKey ? current : []);
      if (grocerySettingKey) void setSetting(grocerySettingKey, next);
      return next;
    });
    if (grocerySettingKey) setLoadedGroceryKey(grocerySettingKey);
  };
  const addGroceriesToList = (listId: string, names: string[]) => {
    const uniqueNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
    if (!uniqueNames.length) return;
    updateGroceryLists((current) => current.map((list) => {
      if (list.id !== listId) return list;
      const seen = new Set(list.items.map((item) => item.name.toLocaleLowerCase()));
      return { ...list, items: [...list.items, ...uniqueNames.filter((name) => !seen.has(name.toLocaleLowerCase())).map((name) => ({ id: crypto.randomUUID(), name, checked: false, addedAt: new Date().toISOString() }))], updatedAt: new Date().toISOString() };
    }));
    setActiveGroceryListId(listId);
    setSection("groceries");
  };
  const addGroceries = (names: string[]) => {
    const uniqueNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
    if (!uniqueNames.length) return;
    if (groceryLists.length > 1) { setPendingGroceries(uniqueNames); setGroceryModal("choose"); return; }
    if (groceryLists[0]) addGroceriesToList(groceryLists[0].id, uniqueNames);
  };
  const createGroceryList = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = groceryListDraft.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const list = { id: crypto.randomUUID(), name, items: pendingGroceries.map((item) => ({ id: crypto.randomUUID(), name: item, checked: false, addedAt: now })), createdAt: now, updatedAt: now };
    updateGroceryLists((current) => [...current, list]); setActiveGroceryListId(list.id); setGroceryListDraft(""); setGroceryModal(null);
    setPendingGroceries([]);
  };
  const renameGroceryList = () => {
    const name = groceryListDraft.trim();
    if (!name || !activeGroceryListId) return;
    updateGroceryLists((current) => current.map((list) => list.id === activeGroceryListId ? { ...list, name, updatedAt: new Date().toISOString() } : list)); setGroceryListDraft("");
  };
  const deleteGroceryList = () => {
    if (groceryLists.length < 2 || !activeGroceryListId || !window.confirm("Delete this grocery list and its items?")) return;
    const remaining = groceryLists.filter((list) => list.id !== activeGroceryListId);
    setActiveGroceryListId(remaining[0].id); updateGroceryLists(() => remaining);
  };
  const addGrocery = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    addGroceries([groceryDraft]);
    setGroceryDraft("");
  };
  const attachCoachImage = async (file?: File) => {
    if (!file) return;
    try {
      setAttachedImage(await imageToDataUrl(file));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That photo could not be attached. Try another image.");
    }
  };

  if (!configured) return (
      <main className="page coach-page"><header className="page-header"><span className="eyebrow">Nutrition only</span><h1>Coach</h1><p>{hideCalories ? "Nutrition guidance using your actual diary." : "Calorie-aware guidance using your actual diary."}</p></header><section className="coach-gate card"><MessageCircle /><h2>Coach setup is waiting</h2><p>Connect the project database to activate private, diary-aware coaching.</p></section></main>
  );
  if (!user) return (
      <main className="page coach-page"><header className="page-header"><span className="eyebrow">Nutrition only</span><h1>Coach</h1><p>{hideCalories ? "Nutrition guidance using your actual diary." : "Calorie-aware guidance using your actual diary."}</p></header><section className="coach-gate card"><MessageCircle /><h2>Sign in for private coaching</h2><p>The Coach reads only the signed-in user’s targets, meals, and saved foods.</p><button className="primary-button" onClick={onOpenAccount}><Mail size={17} />Open account setup</button></section></main>
  );
  if (loadedUserId !== user.id) return (
    <main className="page coach-page"><header className="page-header"><span className="eyebrow">Your diary, in context</span><h1>Coach</h1></header><section className="coach-gate card"><span className="coach-loader" /><h2>Loading your private Coach…</h2></section></main>
  );

  const starters = [hideCalories ? "How are my nutrients today?" : "How am I doing today?", "Plan a quick dinner and make a grocery list", "What can I make with chicken and broccoli?"];
  const activeGroceryList = groceryLists.find((list) => list.id === activeGroceryListId) || groceryLists[0];
  const activeChat = chats.find((chat) => chat.id === activeChatId);
  const accountGroceryItems = loadedGroceryKey === grocerySettingKey ? activeGroceryList?.items || [] : [];
  const remainingGroceries = accountGroceryItems.filter((item) => !item.checked).length;
  return (
    <main className={`page coach-page coach-text-${chatTextSize}`}>
      <header className="coach-header">{section === "chat" && <button className="coach-mobile-menu" type="button" aria-expanded={mobileHistoryOpen} aria-controls="coach-history-drawer" aria-label={mobileHistoryOpen ? "Close previous chats" : "Open previous chats"} onClick={() => setMobileHistoryOpen((open) => !open)}>{mobileHistoryOpen ? <X size={19} /> : <Menu size={19} />}</button>}<div><span className="eyebrow">Your food companion</span><h1>{section === "chat" ? activeChat?.title || "New conversation" : "Coach"}</h1></div>{section === "chat" && <div className="coach-header-actions">{messages.length > 0 && <button className="text-button muted" onClick={() => void clear()}>Clear</button>}</div>}</header>
      {section === "chat" && mobileHistoryOpen && <button className="coach-mobile-backdrop" type="button" aria-label="Close previous chats" onClick={() => setMobileHistoryOpen(false)} />}
      <div className="coach-layout">
        {section === "chat" && <aside id="coach-history-drawer" className={`coach-history ${mobileHistoryOpen ? "mobile-open" : ""}`} aria-label="Previous chats"><div className="coach-history-heading"><span className="coach-history-label">Chats</span><button className="coach-history-mobile-toggle" type="button" aria-expanded={mobileHistoryOpen} aria-label="Close previous chats" onClick={() => setMobileHistoryOpen(false)}><span>{activeChat?.title || "New conversation"}</span><Menu size={17} /></button><button className="icon-button ghost" type="button" onClick={() => void newChat()} aria-label="Start a new chat"><Plus size={16} /></button></div><div className="coach-history-list">{chats.map((chat) => <div className={`coach-history-row ${chat.id === activeChatId ? "active" : ""}`} key={chat.id}>{renamingChatId === chat.id ? <form className="coach-rename-form" onSubmit={(event) => { event.preventDefault(); void saveRename(); }}><input autoFocus value={renameDraft} onChange={(event) => setRenameDraft(event.target.value)} maxLength={120} aria-label="Chat name" /><button type="submit" aria-label="Save chat name"><Check size={14} /></button></form> : <><button className="coach-history-chat" type="button" title={chat.title} onClick={() => { void switchChat(chat.id); setMobileHistoryOpen(false); }}><span>{chat.title}</span><small>{new Date(chat.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small></button><button className="coach-history-rename" type="button" onClick={() => beginRename(chat)} aria-label={`Rename ${chat.title}`}><Pencil size={14} /></button></>}</div>)}</div>{chats.length > 1 && <button className="text-button danger coach-delete-chat" type="button" onClick={() => void removeChat()}><Trash2 size={14} />Delete current chat</button>}</aside>}
        <div className="coach-main">
      <div className="coach-tabs" role="tablist" aria-label="Coach workspace"><button id="coach-chat-tab" role="tab" aria-selected={section === "chat"} aria-controls="coach-chat-panel" className={section === "chat" ? "active" : ""} onClick={() => setSection("chat")}><MessageCircle size={16} />Chat</button><button id="coach-groceries-tab" role="tab" aria-selected={section === "groceries"} aria-controls="coach-groceries-panel" className={section === "groceries" ? "active" : ""} onClick={() => setSection("groceries")}><ListChecks size={16} />Groceries{remainingGroceries > 0 && <span>{remainingGroceries}</span>}</button></div>
      {section === "chat" && <>
        <div className="coach-scope"><ShieldCheck size={15} /><span>{hideCalories ? "Food and nutrition only" : "Food, calories and nutrition"} · recipes and grocery lists are saved only when you choose</span></div>
        <section className="coach-thread" aria-live="polite">
          {messages.length === 0 && <div className="coach-welcome"><span className="coach-orb"><Sparkles /></span><h2>What should we make?</h2><p>Talk through dinner, use up what you have, or log a packaged food by scanning its barcode or photographing its nutrition label.</p><div className="coach-starters">{starters.map((starter) => <button key={starter} onClick={() => send(starter)}>{starter}</button>)}</div></div>}
          {messages.map((message) => { const visibleContent = hideCalories ? hideCalorieValues(message.content) : message.content; const groceries = message.role === "assistant" ? groceryItemsFromReply(visibleContent) : []; return <article key={message.id} className={`coach-message ${message.role}`}><span>{message.role === "assistant" ? "Coach" : "You"}</span>{message.imageUrl && <img className="coach-message-image" src={message.imageUrl} alt="Photo shared with Coach" />}<p>{visibleContent}</p>{message.mealAction && <div className="coach-log-confirmation"><Check size={16} /><span>Logged as {mealLabels[message.mealAction.mealType]} · {message.mealAction.loggedDate}</span></div>}{message.mealChoices && <div className="coach-meal-choices"><strong>Choose where to log it</strong>{message.mealChoices.map((choice) => <button key={choice.label} type="button" disabled={loggedChoiceLabels.includes(choice.label)} onClick={() => void logChoice(choice)}>{loggedChoiceLabels.includes(choice.label) ? "Logged · " : ""}{choice.label}</button>)}</div>}{groceries.length > 0 && <div className="recipe-grocery-action"><strong>Want to cook this?</strong><button className="add-groceries" onClick={() => addGroceries(groceries)}><ListChecks size={15} />Add {groceries.length} ingredients to groceries</button></div>}{!!message.sources?.length && <div className="coach-sources"><strong>Sources</strong>{message.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}</div>}</article>; })}
          {loading && <div className="coach-typing"><i /><i /><i /><span>Coach is thinking through it…</span></div>}
          {error && <div className="inline-alert error" role="alert"><Info size={17} /><span>{error}</span><button className="text-button" type="button" onClick={() => { setError(""); setLoadedUserId(""); setHistoryAttempt((value) => value + 1); }}>Retry</button></div>}
          <div ref={endRef} />
        </section>
        <div className="coach-composer-wrap"><div className="coach-log-actions"><button type="button" onClick={() => onOpenAdd("scan")}><ScanLine size={16} />Scan barcode</button><button type="button" onClick={() => onOpenAdd("camera")}><Camera size={16} />Read nutrition label</button></div><form className="coach-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>{attachedImage && <div className="coach-attachment"><img src={attachedImage} alt="Photo attached to your message" /><button type="button" onClick={() => setAttachedImage(null)} aria-label="Remove attached photo"><X size={15} /></button></div>}<input ref={coachImageInputRef} className="visually-hidden-file" type="file" accept="image/*" onChange={(event) => { void attachCoachImage(event.target.files?.[0]); event.currentTarget.value = ""; }} /><button className="coach-attach" type="button" aria-label="Attach a photo" onClick={() => coachImageInputRef.current?.click()}><Plus /></button><input aria-label="Message the nutrition Coach" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={6000} placeholder={attachedImage ? "Add a note about this photo…" : "Ask about dinner, recipes, or your food log…"} /><button className="coach-send" type="submit" disabled={(!draft.trim() && !attachedImage) || loading} aria-label="Send"><Send /></button></form></div>
      </>}
      {section === "groceries" && <section className="grocery-workspace"><div className="grocery-intro"><span className="coach-orb"><ListChecks /></span><div><h2>{activeGroceryList?.name || "Your groceries"}</h2><p>Keep separate lists for meal plans, weekly shopping, or different stores.</p></div><button className="icon-button ghost" type="button" onClick={() => { setGroceryListDraft(activeGroceryList?.name || ""); setGroceryModal("manage"); }} aria-label="Manage grocery lists"><Pencil size={16} /></button></div><div className="grocery-list-toolbar"><label htmlFor="grocery-list-select">List</label><select id="grocery-list-select" value={activeGroceryListId} onChange={(event) => setActiveGroceryListId(event.target.value)}>{groceryLists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select><button type="button" className="secondary-button" onClick={() => { setGroceryListDraft(""); setGroceryModal("manage"); }}><Plus size={15} />New list</button></div><form className="grocery-composer" onSubmit={addGrocery}><input value={groceryDraft} onChange={(event) => setGroceryDraft(event.target.value)} placeholder="Add an item yourself" maxLength={120} /><button type="submit" disabled={!groceryDraft.trim()}>Add</button></form>{accountGroceryItems.length > 0 ? <div className="grocery-list">{accountGroceryItems.map((item) => <div key={item.id} className={item.checked ? "checked" : ""}><button className="grocery-toggle" onClick={() => updateGroceryLists((current) => current.map((list) => list.id === activeGroceryListId ? { ...list, items: list.items.map((candidate) => candidate.id === item.id ? { ...candidate, checked: !candidate.checked } : candidate), updatedAt: new Date().toISOString() } : list))} aria-label={`Mark ${item.name} as ${item.checked ? "needed" : "picked up"}`}>{item.checked && <Check size={14} />}</button><span>{item.name}</span><button className="grocery-remove" onClick={() => updateGroceryLists((current) => current.map((list) => list.id === activeGroceryListId ? { ...list, items: list.items.filter((candidate) => candidate.id !== item.id), updatedAt: new Date().toISOString() } : list))} aria-label={`Remove ${item.name}`}><X size={16} /></button></div>)}</div> : <div className="grocery-empty"><Package size={28} /><strong>Start with a dinner idea</strong><p>Ask Coach for a recipe or meal plan, then add the suggested ingredients here.</p><button className="secondary-button" onClick={() => setSection("chat")}><MessageCircle size={16} />Open Coach</button></div>}{accountGroceryItems.some((item) => item.checked) && <button className="text-button muted clear-picked" onClick={() => updateGroceryLists((current) => current.map((list) => list.id === activeGroceryListId ? { ...list, items: list.items.filter((item) => !item.checked), updatedAt: new Date().toISOString() } : list))}>Clear picked-up items</button>}</section>}
      {groceryModal === "choose" && <Sheet label="Choose a grocery list" onClose={() => { setGroceryModal(null); setPendingGroceries([]); }}><div className="sheet-header"><span /><div><span className="eyebrow">Add ingredients</span><h2>Choose a list</h2></div><button className="icon-button ghost" onClick={() => { setGroceryModal(null); setPendingGroceries([]); }} aria-label="Close"><X size={17} /></button></div><p className="grocery-modal-copy">Where should these {pendingGroceries.length} ingredients go?</p><div className="grocery-list-choices">{groceryLists.map((list) => <button key={list.id} type="button" onClick={() => { addGroceriesToList(list.id, pendingGroceries); setPendingGroceries([]); setGroceryModal(null); }}><span><strong>{list.name}</strong><small>{list.items.filter((item) => !item.checked).length} items still needed</small></span><ChevronRight size={17} /></button>)}</div><button type="button" className="secondary-button full" onClick={() => { setGroceryModal("manage"); setGroceryListDraft(""); }}><Plus size={16} />Create a new list</button></Sheet>}
      {groceryModal === "manage" && <Sheet label="Manage grocery lists" onClose={() => setGroceryModal(null)}><div className="sheet-header"><span /><div><span className="eyebrow">Your lists</span><h2>Manage groceries</h2></div><button className="icon-button ghost" onClick={() => setGroceryModal(null)} aria-label="Close"><X size={17} /></button></div><form className="grocery-list-create" onSubmit={createGroceryList}><input value={groceryListDraft} onChange={(event) => setGroceryListDraft(event.target.value)} placeholder="New list name" maxLength={60} /><button className="primary-button" type="submit" disabled={!groceryListDraft.trim()}>Create</button></form><div className="grocery-manage-list">{groceryLists.map((list) => <button key={list.id} type="button" className={list.id === activeGroceryListId ? "active" : ""} onClick={() => { setActiveGroceryListId(list.id); setGroceryListDraft(list.name); }}><span>{list.name}<small>{list.items.length} items</small></span><Check size={16} /></button>)}</div>{activeGroceryList && <div className="grocery-manage-actions"><button className="secondary-button" type="button" onClick={renameGroceryList} disabled={!groceryListDraft.trim()}>Rename selected</button><button className="text-button danger" type="button" onClick={deleteGroceryList} disabled={groceryLists.length < 2}>Delete selected</button></div>}</Sheet>}
        </div>
      </div>
    </main>
  );
}

function BottomNav({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const items: Array<{ tab: Tab; label: string; icon: React.ReactNode }> = [
    { tab: "today", label: "Today", icon: <Home /> },
    { tab: "search", label: "Foods", icon: <Search /> },
    { tab: "coach", label: "Coach", icon: <MessageCircle /> },
    { tab: "insights", label: "Insights", icon: <BarChart3 /> },
    { tab: "profile", label: "Profile", icon: <UserRound /> },
  ];
  return <nav className="bottom-nav" aria-label="Primary navigation">{items.map((item) => <button key={item.tab} aria-current={tab === item.tab ? "page" : undefined} className={`${tab === item.tab ? "active" : ""} ${item.tab === "coach" ? "coach-nav-item" : ""}`} onClick={() => onChange(item.tab)}>{item.icon}<span>{item.label}</span></button>)}</nav>;
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
  onSignUp: (email: string, password: string, name: string) => Promise<{ needsEmailConfirmation: boolean }>;
  onSignInWithProvider: (provider: SocialAuthProvider) => Promise<void>;
  onRequestPasswordReset: (email: string) => Promise<void>;
  onUpdatePassword: (password: string) => Promise<void>;
  passwordRecovery: boolean;
}) {
  const [mode, setMode] = useState<AuthMode>(passwordRecovery ? "update-password" : "sign-in");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
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
    if (isRegistering && !name.trim()) {
      setNotice("Enter your name to create your account.");
      return;
    }
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
        const { needsEmailConfirmation } = await onSignUp(email.trim(), password, name.trim());
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
        <div className="auth-brand"><BrandMark large /><span>Calorie Flow</span></div>
        <div><span className="eyebrow">{isRegistering ? "Create your account" : isUpdatingPassword ? "Choose a new password" : mode === "forgot-password" ? "Reset your password" : "Welcome back"}</span><h1 id="auth-title">{isRegistering ? "Start your flow" : isUpdatingPassword ? "Secure your diary" : mode === "forgot-password" ? "Get back in" : "Sign in to Calorie Flow"}</h1><p>{isRegistering ? "Save your diary privately and keep it in sync across your devices." : isUpdatingPassword ? "Use a new password you have not used elsewhere." : mode === "forgot-password" ? "We’ll email a secure reset link if this address has an account." : "Pick up right where you left off."}</p></div>
        {!configured ? <p className="auth-unavailable"><LockKeyhole size={16} />Account sign-in is unavailable until this deployment is connected to Supabase.</p> : <>
          <form className="auth-form" onSubmit={submit}>
            {isRegistering && <label><span>Name</span><input type="text" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label>}
            {!isUpdatingPassword && <label><span>Email</span><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>}
            {mode !== "forgot-password" && <label><span>{isRegistering || isUpdatingPassword ? "New password" : "Password"}</span><input type="password" autoComplete={isRegistering || isUpdatingPassword ? "new-password" : "current-password"} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" /></label>}
            {(isRegistering || isUpdatingPassword) && <label><span>Confirm password</span><input type="password" autoComplete="new-password" minLength={6} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat your password" /></label>}
            <button className="primary-button" type="submit" disabled={busy}>{busy ? "Please wait…" : isRegistering ? "Create account" : isUpdatingPassword ? "Save new password" : mode === "forgot-password" ? "Email reset link" : "Sign in"}</button>
          </form>
          {!isPasswordReset && <><div className="account-divider"><span>or</span></div><button className="secondary-button auth-google" type="button" disabled={busy} onClick={signInWithGoogle}><GoogleIcon />Continue with Google</button></>}
          {notice && <p className="account-notice" role="status">{notice}</p>}
        </>}
        {!isPasswordReset && <><p className="auth-switch">{isRegistering ? "Already have an account?" : "New to Calorie Flow?"} <button type="button" onClick={() => { setMode(isRegistering ? "sign-in" : "register"); setNotice(""); }}>{isRegistering ? "Sign in" : "Create an account"}</button></p>{mode === "sign-in" && <button className="auth-secondary auth-recovery" type="button" onClick={() => { setMode("forgot-password"); setNotice(""); }}>Forgot your password?</button>}</>}
        {isPasswordReset && <button className="text-button auth-secondary" type="button" onClick={() => { setMode("sign-in"); setNotice(""); }}>Back to sign in</button>}
      </section>
    </main>
  );
}

export function TrackerApp() {
  const auth = useAuth();
  const [ready, setReady] = useState(false);
  const [startupError, setStartupError] = useState("");
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [onboardingOrigin, setOnboardingOrigin] = useState<Profile>();
  const [foods, setFoods] = useState<Food[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [tab, setTab] = useState<Tab>("today");
  const [dateKey, setDateKey] = useState(localDateKey());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [initialAddView, setInitialAddView] = useState<AddView>("start");
  const [directFood, setDirectFood] = useState<Food>();
  const [editingMeal, setEditingMeal] = useState<Meal>();
  const [duplicateMealDraft, setDuplicateMealDraft] = useState<Meal>();
  const [toast, setToast] = useState("");
  const [syncState, setSyncState] = useState<SyncState>("local");
  const [syncAttempt, setSyncAttempt] = useState(0);
  const [theme, setTheme] = useState<ThemeMode>(themeModes.light);
  const [chatTextSize, setChatTextSize] = useState<ChatTextSize>(chatTextSizes.comfortable);
  const [showHomeScreenPrompt, setShowHomeScreenPrompt] = useState(false);
  const [weightPromptDismissedFor, setWeightPromptDismissedFor] = useState<string | null>(null);
  const [undoMeal, setUndoMeal] = useState<{ meal: Meal; timerId: number }>();
  const syncIdentityRef = useRef("");
  const syncMutationRef = useRef(0);
  const cloudWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const cloudWriteFailedRef = useRef(false);

  const refresh = useCallback(async () => {
    await initializeFoods();
    const [storedProfile, storedFoods, storedMeals] = await Promise.all([getSetting<Profile>("profile"), getAll<Food>("foods"), getAll<Meal>("meals")]);
    setProfile(storedProfile || DEFAULT_PROFILE); setFoods(storedFoods); setMeals(storedMeals); setStartupError(""); setReady(true);
  }, []);
  useEffect(() => {
    // IndexedDB is our external store; hydrate it once when the client mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh().catch(() => setStartupError("Your private diary could not be opened. Your data has not been reset."));
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const params = new URLSearchParams(window.location.search);
    if (params.has("scan")) { setInitialAddView("scan"); setAdding(true); }
    else if (params.has("add")) setAdding(true);
  }, [refresh]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2800); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    let active = true;
    getSetting<unknown>(THEME_SETTING).then((storedTheme) => {
      if (active && isThemeMode(storedTheme)) setTheme(storedTheme);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    getSetting<unknown>(CHAT_TEXT_SIZE_SETTING).then((storedSize) => {
      if (active && isChatTextSize(storedSize)) setChatTextSize(storedSize);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!ready || !isMobileDevice()) return;
    if (isStandaloneDisplay()) {
      void setSetting(HOME_SCREEN_PROMPT_SETTING, true);
      return;
    }
    let active = true;
    getSetting<boolean>(HOME_SCREEN_PROMPT_SETTING).then((completed) => {
      if (active) setShowHomeScreenPrompt(completed !== true);
    }).catch(() => {
      if (active) setShowHomeScreenPrompt(true);
    });
    return () => { active = false; };
  }, [ready]);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    const retry = () => { cloudWriteFailedRef.current = false; syncIdentityRef.current = ""; setSyncAttempt((value) => value + 1); };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);
  useEffect(() => {
    if (!ready || !auth.ready || !auth.user) return;
    const user = auth.user;
    const identity = `user:${user.id}`;
    if (syncIdentityRef.current === identity) return;
    syncIdentityRef.current = identity;
    let active = true;
    const synchronize = async () => {
      const mutationAtStart = syncMutationRef.current;
      const owner = await getSetting<string>("dataOwner");
      const userId = user.id;
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
      } else {
        next = mergeSnapshots(local, remote);
        shouldPush = true;
      }

      const accountName = accountDisplayName(user);
      if (accountName && !next.profile?.name.trim()) {
        next.profile = { ...(next.profile || DEFAULT_PROFILE), name: accountName };
        shouldPush = true;
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
        if (mutationAtStart !== syncMutationRef.current) return;
        const mutationAtPush = syncMutationRef.current;
        await pushCloudSnapshot(userId, next);
        if (mutationAtPush === syncMutationRef.current) await setSetting(`cloudDirty:${userId}`, false);
      }
      if (mutationAtStart !== syncMutationRef.current) return;
      await replaceLocalSnapshot(next);
      await setSetting("dataOwner", identity);
      if (active) { cloudWriteFailedRef.current = false; await refresh(); setSyncState("synced"); }
    };
    synchronize().catch(() => {
      if (active) setSyncState(navigator.onLine ? "error" : "offline");
    });
    return () => { active = false; };
  }, [auth.configured, auth.ready, auth.user, ready, refresh, syncAttempt]);

  const dayMeals = useMemo(() => meals.filter((meal) => (meal.loggedDate || localDateKey(new Date(meal.createdAt))) === dateKey).sort(compareMealOrder), [meals, dateKey]);
  const syncWrite = (work: (userId: string) => Promise<void>) => {
    if (!auth.user) return;
    const userId = auth.user.id;
    const mutation = ++syncMutationRef.current;
    setSyncState("syncing");
    void setSetting(`cloudDirty:${userId}`, true)
      .then(() => {
        cloudWriteQueueRef.current = cloudWriteQueueRef.current.catch(() => undefined).then(() => work(userId));
        return cloudWriteQueueRef.current;
      })
      .then(async () => {
        if (mutation !== syncMutationRef.current || cloudWriteFailedRef.current) return;
        await setSetting(`cloudDirty:${userId}`, false);
        setSyncState("synced");
      })
      .catch(() => {
        cloudWriteFailedRef.current = true;
        setSyncState(navigator.onLine ? "error" : "offline");
      });
  };
  const saveProfile = async (next: Profile) => {
    setProfile(next); await setSetting("profile", next); setToast("Profile saved");
    syncWrite((userId) => upsertCloudProfile(userId, next));
  };
  const restartOnboarding = () => {
    setOnboardingOrigin(profile);
    void saveProfile({ ...profile, onboardingDone: false });
  };
  const finishOnboarding = (next: Profile) => {
    setOnboardingOrigin(undefined);
    void saveProfile(next);
  };
  const cancelOnboarding = () => {
    if (!onboardingOrigin) return;
    const previousProfile = onboardingOrigin;
    setOnboardingOrigin(undefined);
    void saveProfile(previousProfile);
  };
  const logMeal = async (meal: Meal, food: Food) => {
    const loggedDate = meal.loggedDate || dateKey;
    const adjustedDate = loggedDate === localDateKey() ? new Date() : new Date(`${loggedDate}T12:00:00`);
    const savedMeal = { ...meal, loggedDate, createdAt: adjustedDate.toISOString() };
    await Promise.all([put("meals", savedMeal), put("foods", food)]);
    setMeals((current) => [...current, savedMeal]);
    setFoods((current) => [food, ...current.filter((item) => item.id !== food.id)]);
    setAdding(false); setDirectFood(undefined); setDateKey(loggedDate); setToast(`${food.name} logged`); setTab("today");
    syncWrite(async (userId) => { await Promise.all([upsertCloudMeal(userId, savedMeal), upsertCloudFood(userId, food)]); });
  };
  const saveEditedMeal = async (meal: Meal) => {
    const savedMeal = { ...meal, loggedDate: meal.loggedDate || dateKey };
    await put("meals", savedMeal);
    setMeals((current) => current.map((candidate) => candidate.id === savedMeal.id ? savedMeal : candidate));
    setEditingMeal(undefined); setToast("Meal updated");
    syncWrite((userId) => upsertCloudMeal(userId, savedMeal));
  };
  const dropMeal = async (meal: Meal, mealType: MealType, targetMealId?: string, insertAfter = false) => {
    const dayMeals = meals.filter((candidate) => (candidate.loggedDate || localDateKey(new Date(candidate.createdAt))) === dateKey).sort(compareMealOrder);
    const nextByType = new Map<MealType, Meal[]>((Object.keys(mealLabels) as MealType[]).map((type) => [type, dayMeals.filter((candidate) => candidate.mealType === type && candidate.id !== meal.id)]));
    const destination = nextByType.get(mealType) || [];
    const targetIndex = targetMealId ? destination.findIndex((candidate) => candidate.id === targetMealId) : -1;
    destination.splice(targetIndex < 0 ? destination.length : targetIndex + (insertAfter ? 1 : 0), 0, { ...meal, mealType, loggedDate: meal.loggedDate || dateKey });
    nextByType.set(mealType, destination);
    const changed = [...nextByType.values()].flat().map((candidate, index) => ({ ...candidate, position: nextByType.get(candidate.mealType)?.findIndex((item) => item.id === candidate.id) ?? index }));
    await Promise.all(changed.map((candidate) => put("meals", candidate)));
    setMeals((current) => current.map((candidate) => changed.find((next) => next.id === candidate.id) || candidate));
    syncWrite((userId) => Promise.all(changed.map((candidate) => upsertCloudMeal(userId, candidate))).then(() => undefined));
    setToast(meal.mealType === mealType ? "Meal order updated" : `Moved to ${mealLabels[mealType]}`);
  };
  const duplicateMeal = async (meal: Meal, mealType: MealType) => {
    const destinationMeals = meals.filter((candidate) => (candidate.loggedDate || localDateKey(new Date(candidate.createdAt))) === dateKey && candidate.mealType === mealType).sort(compareMealOrder);
    const copy: Meal = { ...meal, id: `duplicate-${crypto.randomUUID()}`, mealType, loggedDate: meal.loggedDate || dateKey, createdAt: new Date().toISOString(), position: destinationMeals.length };
    await put("meals", copy);
    setMeals((current) => [...current, copy]);
    syncWrite((userId) => upsertCloudMeal(userId, copy));
    setDuplicateMealDraft(undefined);
    setToast(`Copied to ${mealLabels[mealType]}`);
  };
  const saveNewMeal = async (meal: Meal) => {
    await put("meals", meal);
    setMeals((current) => [...current, meal]); setEditingMeal(undefined); setToast(`${meal.name} logged`); setTab("today");
    syncWrite((userId) => upsertCloudMeal(userId, meal));
  };
  const logCoachMeal = async (action: CoachMealAction) => {
    const meal: Meal = {
      id: `coach-${crypto.randomUUID()}`,
      name: action.name,
      mealType: action.mealType,
      amount: action.amount,
      unit: action.unit,
      grams: action.grams,
      nutrition: action.nutrition,
      createdAt: new Date(`${action.loggedDate}T12:00:00`).toISOString(),
      loggedDate: action.loggedDate,
      source: "custom",
      estimated: action.estimated,
    };
    // Mark the mutation before the async IndexedDB write so an initial cloud
    // snapshot cannot replace this meal during the write window.
    syncMutationRef.current += 1;
    await put("meals", meal);
    const storedMeals = await getAll<Meal>("meals");
    if (!storedMeals.some((candidate) => candidate.id === meal.id)) throw new Error("The meal was not written to the local diary.");
    setMeals((current) => [...current, meal]);
    setDateKey(action.loggedDate);
    setTab("today");
    setToast(`${meal.name} logged`);
    syncWrite((userId) => upsertCloudMeal(userId, meal));
  };
  const addPhotoMeal = (analysis: MealPhotoAnalysis) => {
    const details = analysis.components.length ? ` · ${analysis.components.join(", ")}` : "";
    const meal: Meal = { id: `photo-${crypto.randomUUID()}`, name: `${analysis.name}${details}`.slice(0, 240), mealType: analysis.mealType, amount: analysis.amount, unit: analysis.unit, grams: analysis.grams, nutrition: analysis.nutrition, createdAt: new Date().toISOString(), loggedDate: dateKey, source: "custom", estimated: analysis.confidence !== "high" };
    setAdding(false); setEditingMeal(meal);
  };
  const deleteMeal = async (id: string) => {
    const deletedMeal = meals.find((meal) => meal.id === id);
    if (!deletedMeal) return;
    await remove("meals", id); setMeals((current) => current.filter((meal) => meal.id !== id)); setToast("");
    let deletionKey: string | undefined;
    if (auth.user) {
      deletionKey = `deletedMealIds:${auth.user.id}`;
      const current = await getSetting<string[]>(deletionKey) || [];
      await setSetting(deletionKey, [...new Set([...current, id])]);
    }
    const timerId = window.setTimeout(() => {
      setUndoMeal((pending) => pending?.meal.id === id ? undefined : pending);
      setToast("Meal removed");
      if (deletionKey) syncWrite(async (userId) => {
        await deleteCloudMeal(userId, id);
        const remaining = (await getSetting<string[]>(deletionKey) || []).filter((mealId) => mealId !== id);
        await setSetting(deletionKey, remaining);
      });
    }, 6000);
    setUndoMeal({ meal: deletedMeal, timerId });
  };
  const undoDeleteMeal = async () => {
    if (!undoMeal) return;
    const { meal, timerId } = undoMeal;
    window.clearTimeout(timerId);
    setUndoMeal(undefined);
    await put("meals", meal);
    setMeals((current) => [...current.filter((candidate) => candidate.id !== meal.id), meal]);
    if (auth.user) {
      const key = `deletedMealIds:${auth.user.id}`;
      await setSetting(key, (await getSetting<string[]>(key) || []).filter((mealId) => mealId !== meal.id));
      syncWrite((userId) => upsertCloudMeal(userId, meal));
    }
    setToast("Meal restored");
  };
  const exportBackup = async (): Promise<BackupData> => {
    const local = await exportData();
    if (!auth.user) return local;
    const [remote, coachMessages] = await Promise.all([getCloudSnapshot(auth.user.id), getAllCloudCoachMessages(auth.user.id)]);
    const merged = mergeSnapshots({ profile: local.profile, meals: local.meals, foods: local.foods }, remote);
    return { ...local, ...merged, coachMessages };
  };
  const restoreBackup = async (data: BackupData, mode: "merge" | "replace") => {
    if (mode === "replace") await replaceData(data);
    else await importData(data);
    await refresh(); setToast(mode === "replace" ? "Backup replaced current data" : "Backup restored");
    if (auth.user) syncWrite(async (userId) => {
      if (mode === "replace") await clearCloudCoachMessages(userId);
      const importedChats = [...new Set((data.coachMessages || []).map((message) => message.chatId))].map((chatId) => {
        const firstMessage = data.coachMessages?.find((message) => message.chatId === chatId);
        const createdAt = firstMessage?.createdAt || new Date().toISOString();
        return { id: chatId, title: "Restored conversation", createdAt, updatedAt: createdAt };
      });
      await Promise.all([
        mode === "replace" ? replaceCloudSnapshot(userId, await getLocalSnapshot()) : pushCloudSnapshot(userId, await getLocalSnapshot()),
        ...importedChats.map((chat) => saveCloudCoachChat(userId, chat)),
        ...((data.coachMessages || []).map((message) => saveCloudCoachMessage(userId, message))),
      ]);
    });
  };
  const openAdd = (view: AddView = "start") => { setInitialAddView(view); setAdding(true); };
  const selectFood = (food: Food) => { setDirectFood(food); setAdding(true); };
  const signOut = async () => { await auth.signOut(); };
  const changeTheme = (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    void setSetting(THEME_SETTING, nextTheme);
  };
  const changeChatTextSize = (nextSize: ChatTextSize) => {
    setChatTextSize(nextSize);
    void setSetting(CHAT_TEXT_SIZE_SETTING, nextSize);
  };
  const weightTrackingEnabled = profile.weightTracking === weightTrackingStatuses.enabled;
  const weightPromptOpen = profile.onboardingDone && profile.weightTracking === undefined && weightPromptDismissedFor !== auth.user?.id;
  const enableWeightTracking = () => { setWeightPromptDismissedFor(auth.user?.id || ""); void saveProfile({ ...profile, weightTracking: weightTrackingStatuses.enabled }); };
  const disableWeightTracking = () => { void saveProfile({ ...profile, weightTracking: weightTrackingStatuses.disabled }); };
  const deferWeightTracking = () => setWeightPromptDismissedFor(auth.user?.id || "");

  const syncLabel: Record<SyncState, string> = {
    local: "Private on this device",
    syncing: "Syncing…",
    synced: "Synced privately",
    offline: "Saved offline",
    error: "Sync needs attention",
  };

  if (startupError) return <main className="app-loading load-error" role="alert"><Database size={30} /><h1>Diary unavailable</h1><p>{startupError}</p><button className="primary-button" onClick={() => { setStartupError(""); void refresh().catch(() => setStartupError("Your private diary could not be opened. Your data has not been reset.")); }}>Try again</button></main>;
  if (!ready || !auth.ready) return <div className="app-loading" role="status" aria-label="Opening your private diary"><BrandMark large /><i /></div>;
  if (auth.passwordRecovery || !auth.user) return <AuthGateway key={auth.passwordRecovery ? "recovery" : "sign-in"} configured={auth.configured} passwordRecovery={auth.passwordRecovery} onSignIn={auth.signInWithPassword} onSignUp={auth.signUp} onSignInWithProvider={auth.signInWithProvider} onRequestPasswordReset={auth.requestPasswordReset} onUpdatePassword={auth.updatePassword} />;
  const modalOpen = adding || !!editingMeal || calendarOpen || !profile.onboardingDone || weightPromptOpen;
  return (
    <div className="app-shell">
      <div className="ambient one" /><div className="ambient two" />
      <div className="content-shell" inert={modalOpen} aria-hidden={modalOpen || undefined}>
        {tab === "today" && <TodayView profile={profile} meals={dayMeals} dateKey={dateKey} onDateChange={setDateKey} onAdd={() => openAdd()} onOpenCoach={() => setTab("coach")} onDelete={deleteMeal} onEdit={setEditingMeal} onDropMeal={dropMeal} onDuplicate={setDuplicateMealDraft} syncLabel={auth.user ? syncLabel[syncState] : "Private on this device"} showHomeScreenPrompt={showHomeScreenPrompt} onDismissHomeScreenPrompt={() => setShowHomeScreenPrompt(false)} onOpenCalendar={() => setCalendarOpen(true)} />}
        {tab === "search" && <DiscoverView foods={foods} hideCalories={profile.hideCalories} onSelect={selectFood} onAdd={openAdd} />}
        {tab === "coach" && <CoachView configured={auth.configured} user={auth.user} hideCalories={profile.hideCalories} chatTextSize={chatTextSize} onLogCoachMeal={logCoachMeal} onOpenAccount={() => setTab("profile")} onOpenAdd={openAdd} />}
        {tab === "insights" && <InsightsView meals={meals} profile={profile} onSave={saveProfile} weightTrackingEnabled={weightTrackingEnabled} />}
      {tab === "profile" && <ProfileView profile={profile} onSave={saveProfile} onRestartOnboarding={restartOnboarding} onExport={exportBackup} onImport={restoreBackup} user={auth.user} syncState={syncState} onSignOut={signOut} theme={theme} onThemeChange={changeTheme} chatTextSize={chatTextSize} onChatTextSizeChange={changeChatTextSize} weightTracking={profile.weightTracking} />}
      </div>
      <div inert={modalOpen} aria-hidden={modalOpen || undefined}><BottomNav tab={tab} onChange={(nextTab) => { window.scrollTo(0, 0); setTab(nextTab); }} /></div>
      {adding && profile.onboardingDone && <Sheet onClose={() => { setAdding(false); setDirectFood(undefined); }} wide>{directFood ? <PortionSheet food={directFood} hideCalories={profile.hideCalories} onLog={logMeal} onClose={() => { setDirectFood(undefined); setAdding(false); }} /> : <AddFoodSheet foods={foods} hideCalories={profile.hideCalories} initialView={initialAddView} onClose={() => setAdding(false)} onLog={logMeal} onMealPhoto={addPhotoMeal} />}</Sheet>}
      {calendarOpen && <Sheet onClose={() => setCalendarOpen(false)} wide label="Calendar"><CalendarSheet dateKey={dateKey} meals={meals} profile={profile} onDateChange={setDateKey} onClose={() => setCalendarOpen(false)} /></Sheet>}
      {editingMeal && <Sheet onClose={() => setEditingMeal(undefined)}><MealEditor meal={editingMeal} hideCalories={profile.hideCalories} onSave={(meal) => editingMeal.id.startsWith("photo-") ? saveNewMeal(meal) : saveEditedMeal(meal)} onClose={() => setEditingMeal(undefined)} /></Sheet>}
      {duplicateMealDraft && <Sheet onClose={() => setDuplicateMealDraft(undefined)} label="Duplicate meal" className="duplicate-meal-dialog"><DuplicateMealSheet meal={duplicateMealDraft} onDuplicate={(mealType) => void duplicateMeal(duplicateMealDraft, mealType)} onClose={() => setDuplicateMealDraft(undefined)} /></Sheet>}
      {!profile.onboardingDone && <OnboardingDialog profile={profile} onSave={finishOnboarding} onCancel={onboardingOrigin ? cancelOnboarding : undefined} />}
      {weightPromptOpen && <WeightTrackingPrompt onEnable={enableWeightTracking} onDisable={disableWeightTracking} onDefer={deferWeightTracking} />}
      {undoMeal && <div className="toast undo-toast" role="status"><span>Meal removed</span><button type="button" onClick={undoDeleteMeal}>Undo</button></div>}
      {toast && <div className="toast"><Check size={17} />{toast}</div>}
    </div>
  );
}
