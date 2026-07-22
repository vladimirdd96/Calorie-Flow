"use client";

import { Check, Copy, ChevronDown, ChevronLeft, ChevronRight, Droplets, GripVertical, Info, ImagePlus, MessageCircle, MoreHorizontal, ArrowRightLeft, BookOpen, Pencil, Plus, Share2, ShieldCheck, Sparkles, Sun, Timer, Trash2, Utensils, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ThemedSelect } from "@/features/shared/ThemedSelect";
import { Sheet } from "@/features/shared/Sheet";
import { remove } from "@/lib/db";
import { formatUnit, localDateKey, netCarbs, round, resolveDailyTargets, resolveMealCalorieTarget, sumNutrition } from "@/lib/nutrition";
import { hydrationTotal, setWaterAmount } from "@/lib/hydration";
import { activeFast, fastingProgress, fastingWindowHours } from "@/lib/fasting";
import { isHabitFeatureEnabled } from "@/lib/habit-settings";
import { canLogRecipeIngredients, recipeIngredientFood, recipeIngredientNutrition, recipeLogId, recipeNutritionForLogging } from "@/features/recipes/recipeLogging";
import { getSupabase } from "@/lib/supabase";
import type { Food, Meal, MealType, Nutrition, Profile, Recipe, RecipeIngredient } from "@/lib/types";
import { fastingGoalHours, habitFeatures } from "@/lib/types";

function BrandMark({ large = false }: { large?: boolean }) {
  return <img className={`brand-mark${large ? " large" : ""}`} src="/icon.svg" alt="" aria-hidden="true" />;
}

const mealLabels: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
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

function ProgressRing({ value, target, nutrition }: { value: number; target: number; nutrition: Nutrition }) {
  const [activeSegment, setActiveSegment] = useState<string>();
  const progress = Math.min(1, value / Math.max(1, target));
  const circumference = 2 * Math.PI * 82;
  const macroSegments = [
    { label: "Protein", grams: nutrition.protein, value: nutrition.protein * 4, color: "var(--protein)" },
    { label: "Carbs", grams: nutrition.carbs, value: nutrition.carbs * 4, color: "var(--carbs)" },
    { label: "Fat", grams: nutrition.fat, value: nutrition.fat * 9, color: "var(--fat)" },
  ];
  const macroCalories = macroSegments.reduce((sum, segment) => sum + segment.value, 0);
  const selectedSegment = macroSegments.find((segment) => segment.label === activeSegment);
  let consumedOffset = 0;
  return (
    <div className="progress-ring" role="progressbar" aria-label={`Daily calorie progress. Protein ${round(nutrition.protein)} grams, carbs ${round(nutrition.carbs)} grams, fat ${round(nutrition.fat)} grams.`} aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.round(value)} aria-valuetext={`${Math.round(progress * 100)} percent of daily calories`}>
      <svg viewBox="0 0 200 200" role="img" aria-label="Macro calorie composition">
        <circle className="ring-track" cx="100" cy="100" r="82" />
        {macroSegments.map((segment) => {
          const share = macroCalories > 0 ? segment.value / macroCalories : 0;
          const length = circumference * progress * share;
          const offset = circumference * progress * consumedOffset;
          consumedOffset += share;
          const percentOfTarget = Math.round((segment.value / Math.max(1, target)) * 100);
          return <circle key={segment.label} className={`ring-segment${activeSegment === segment.label ? " active" : ""}`} cx="100" cy="100" r="82" stroke={segment.color} strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} tabIndex={0} role="img" aria-label={`${segment.label}: ${round(segment.grams)} grams, ${Math.round(segment.value)} calories, ${percentOfTarget}% of daily target`} onMouseEnter={() => setActiveSegment(segment.label)} onMouseLeave={() => setActiveSegment(undefined)} onFocus={() => setActiveSegment(segment.label)} onBlur={() => setActiveSegment(undefined)} />;
        })}
      </svg>
      {selectedSegment && <div className="ring-tooltip" role="status"><strong>{selectedSegment.label}</strong><span>{round(selectedSegment.grams)} g · {Math.round(selectedSegment.value)} kcal</span><small>{Math.round((selectedSegment.value / Math.max(1, target)) * 100)}% of daily target</small></div>}
      <div className="ring-content">
        <span className="eyebrow">Eaten</span>
        <strong>{Math.round(value).toLocaleString()}</strong>
        <span>of {target.toLocaleString()} kcal</span>
      </div>
      <div className="ring-legend" aria-hidden="true">
        {macroSegments.map((segment) => <span key={segment.label}><i style={{ background: segment.color }} />{segment.label}</span>)}
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

async function readMealImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 8_000_000) throw new Error("That image is too large. Choose one under 8 MB.");
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("The image could not be read."));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new window.Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("The image could not be opened."));
    element.src = source;
  });
  const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  const resized = canvas.toDataURL("image/jpeg", 0.82);
  if (resized.length > 400_000) throw new Error("That image is still too large after resizing. Choose a simpler photo.");
  return resized;
}

function MealRow({ meal, onDelete, onEdit, onDuplicate, onMove, onDetails, onOpenImage, onDragStart, onDragOver, onDrop, onPointerDown, dropPosition, dragging, hideCalories }: { meal: Meal; onDelete: () => void; onEdit: () => void; onDuplicate: () => void; onMove: () => void; onDetails: () => void; onOpenImage: () => void; onDragStart: (meal: Meal, event: React.DragEvent<HTMLDivElement>) => void; onDragOver: (event: React.DragEvent<HTMLDivElement>) => void; onDrop: (event: React.DragEvent<HTMLDivElement>) => void; onPointerDown: (meal: Meal, event: React.PointerEvent<HTMLButtonElement>) => void; dropPosition?: "before" | "after"; dragging?: boolean; hideCalories: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", closeOnEscape); };
  }, [menuOpen]);
  return (
    <div className={`meal-row ${dropPosition ? `drop-${dropPosition}` : ""}${dragging ? " dragging" : ""}`} draggable onDragStart={(event) => onDragStart(meal, event)} onDragOver={onDragOver} onDrop={onDrop} data-meal-id={meal.id} data-meal-type={meal.mealType} title="Drag this meal to reorder it or move it to another meal section" aria-label={`Drag ${meal.name} to reorder it or move it to another meal section`}>
      <button type="button" className="meal-drag-handle" onPointerDown={(event) => onPointerDown(meal, event)} aria-label={`Hold and drag ${meal.name} to reorder it`}><GripVertical size={17} aria-hidden="true" /></button>
      {meal.imageUrl ? <button type="button" className="meal-icon meal-image-trigger" onClick={onOpenImage} aria-label={`Expand photo for ${meal.name}`}><img src={meal.imageUrl} alt="" /></button> : <div className="meal-icon"><Utensils size={17} /></div>}
      <button type="button" className="meal-detail-trigger" onClick={onDetails} aria-label={`View nutrition details for ${meal.name}`}><div className="meal-copy">
        <strong>{meal.name}</strong>
        <span>{meal.amount} {formatUnit(meal.unit, meal.amount)} · {new Date(meal.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · P {meal.nutrition.protein} · C {meal.nutrition.carbs} · F {meal.nutrition.fat}</span>
      </div></button>
      {!hideCalories && <strong className="meal-kcal"><span>{Math.round(meal.nutrition.calories)}</span><small>kcal</small></strong>}
      <span ref={menuRef} className="meal-actions"><button type="button" className="meal-menu-trigger" onClick={() => setMenuOpen((open) => !open)} aria-label={`Options for ${meal.name}`} aria-expanded={menuOpen}><MoreHorizontal size={18} /></button>{menuOpen && <span className="meal-action-menu" role="menu"><button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onMove(); }}><ArrowRightLeft size={14} />Move</button><button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onEdit(); }}><Pencil size={14} />Edit</button><button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onDuplicate(); }}><Copy size={14} />Duplicate</button><button type="button" role="menuitem" className="danger" onClick={() => { setMenuOpen(false); onDelete(); }}><Trash2 size={14} />Delete</button></span>}</span>
    </div>
  );
}

export function MoveMealSheet({ meal, onMove, onClose }: { meal: Meal; onMove: (mealType: MealType) => void; onClose: () => void }) {
  const [mealType, setMealType] = useState<MealType>(meal.mealType);
  return <div className="meal-editor duplicate-meal-sheet"><div className="sheet-header"><div><span className="eyebrow">Your diary</span><h2>Move meal</h2></div></div><div className="duplicate-meal-copy"><strong>{meal.name}</strong><p>Choose a meal section. On mobile, this is the quickest way to move food.</p></div><label className="meal-editor-form"><span>Move to</span><ThemedSelect ariaLabel="Move to" value={mealType} onChange={(value) => setMealType(value as MealType)} options={(Object.keys(mealLabels) as MealType[]).map((type) => ({ value: type, label: mealLabels[type] }))} /></label><div className="sheet-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="button" className="primary-button" onClick={() => onMove(mealType)}><ArrowRightLeft size={17} />Move meal</button></div></div>;
}

export function DuplicateMealSheet({ meal, onDuplicate, onClose }: { meal: Meal; onDuplicate: (mealType: MealType) => void; onClose: () => void }) {
  const [mealType, setMealType] = useState<MealType>(meal.mealType);
  return <div className="meal-editor duplicate-meal-sheet"><div className="sheet-header"><div><span className="eyebrow">Your diary</span><h2>Duplicate meal</h2></div></div><div className="duplicate-meal-copy"><strong>{meal.name}</strong><p>Choose where to add a copy. The original meal stays where it is.</p></div><label className="meal-editor-form"><span>Add copy to</span><ThemedSelect ariaLabel="Add copy to" value={mealType} onChange={(value) => setMealType(value as MealType)} options={(Object.keys(mealLabels) as MealType[]).map((type) => ({ value: type, label: mealLabels[type] }))} /></label><div className="sheet-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="button" className="primary-button" onClick={() => onDuplicate(mealType)}><Copy size={17} />Duplicate</button></div></div>;
}

export function MealEditor({ meal, onSave, onClose, hideCalories }: { meal: Meal; onSave: (meal: Meal) => void; onClose: () => void; hideCalories: boolean }) {
  const [name, setName] = useState(meal.name);
  const [amount, setAmount] = useState(String(meal.amount));
  const [mealType, setMealType] = useState<MealType>(meal.mealType);
  const [nutrition, setNutrition] = useState(() => ({
    calories: String(Math.round(meal.nutrition.calories)),
    protein: String(meal.nutrition.protein),
    carbs: String(meal.nutrition.carbs),
    fat: String(meal.nutrition.fat),
    fiber: String(meal.nutrition.fiber),
    sugar: String(meal.nutrition.sugar),
  }));
  const [error, setError] = useState("");
  const [imageUrl, setImageUrl] = useState(meal.imageUrl);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const updateNutrition = (key: keyof typeof nutrition, value: string) => setNutrition((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextAmount = Number(amount);
    const nextNutrition = Object.fromEntries(Object.entries(nutrition).map(([key, value]) => [key, Number(value)])) as Record<keyof typeof nutrition, number>;
    if (!name.trim() || !Number.isFinite(nextAmount) || nextAmount <= 0 || Object.values(nextNutrition).some((value) => !Number.isFinite(value) || value < 0)) {
      setError("Add a meal name, a positive amount, and zero or positive nutrition values.");
      return;
    }
    const ratio = meal.amount > 0 ? nextAmount / meal.amount : 1;
    onSave({ ...meal, name: name.trim(), amount: nextAmount, mealType, imageUrl, grams: round(meal.grams * ratio), nutrition: { ...meal.nutrition, ...nextNutrition, calories: Math.round(nextNutrition.calories) } });
  };
  const chooseImage = async (file: File | undefined) => {
    if (!file) return;
    try { setImageUrl(await readMealImage(file)); setError(""); }
    catch (imageError) { setError(imageError instanceof Error ? imageError.message : "The image could not be added."); }
  };
  return <div className="meal-editor">
    <div className="sheet-header"><div><span className="eyebrow">Your diary</span><h2 id="meal-editor-title">Edit meal</h2></div><span /></div>
    <form className="meal-editor-form" onSubmit={submit}>
      <label><span>Meal and additions</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={240} /></label>
      <section className="meal-photo-editor" aria-labelledby="meal-photo-heading">
        <div><span className="eyebrow" id="meal-photo-heading">Meal photo</span><small>Optional. Stored privately with this diary entry.</small></div>
        {imageUrl ? <div className="meal-photo-preview"><img src={imageUrl} alt="Preview of this meal" /><div><strong>Photo added</strong><small>You can replace it or remove it below.</small><button type="button" className="secondary-button" onClick={() => imageInputRef.current?.click()}>Replace photo</button><button type="button" className="text-button muted" onClick={() => setImageUrl(undefined)}>Remove</button></div></div> : <button type="button" className="meal-photo-upload" onClick={() => imageInputRef.current?.click()}><span className="meal-photo-upload-icon"><ImagePlus size={19} /></span><span className="meal-photo-upload-copy"><strong>Add a meal photo</strong><small>Choose from your device</small></span><ChevronRight size={17} aria-hidden="true" /> </button>}
        <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={(event) => { void chooseImage(event.target.files?.[0]); event.target.value = ""; }} />
      </section>
      <div className="form-grid two"><label><span>Amount</span><input type="number" min="0.1" step="0.1" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label><span>Meal</span><ThemedSelect ariaLabel="Meal" value={mealType} onChange={(value) => setMealType(value as MealType)} options={(Object.keys(mealLabels) as MealType[]).map((type) => ({ value: type, label: mealLabels[type] }))} /></label></div>
      <section className="editor-nutrition" aria-labelledby="meal-nutrition-heading">
        <div className="editor-nutrition-heading"><div><span className="eyebrow" id="meal-nutrition-heading">Nutrition for this entry</span><small>Adjust what you actually ate.</small></div><Pencil size={17} aria-hidden="true" /></div>
        <div className="form-grid three editor-nutrition-fields">
          {!hideCalories && <label><span>Calories <small>kcal</small></span><input required min="0" step="1" type="number" inputMode="numeric" value={nutrition.calories} onChange={(event) => updateNutrition("calories", event.target.value)} /></label>}
          <label><span>Protein <small>g</small></span><input min="0" step="0.1" type="number" inputMode="decimal" value={nutrition.protein} onChange={(event) => updateNutrition("protein", event.target.value)} /></label>
          <label><span>Carbs <small>g</small></span><input min="0" step="0.1" type="number" inputMode="decimal" value={nutrition.carbs} onChange={(event) => updateNutrition("carbs", event.target.value)} /></label>
          <label><span>Fat <small>g</small></span><input min="0" step="0.1" type="number" inputMode="decimal" value={nutrition.fat} onChange={(event) => updateNutrition("fat", event.target.value)} /></label>
          <label><span>Fibre <small>g</small></span><input min="0" step="0.1" type="number" inputMode="decimal" value={nutrition.fiber} onChange={(event) => updateNutrition("fiber", event.target.value)} /></label>
          <label><span>Sugar <small>g</small></span><input min="0" step="0.1" type="number" inputMode="decimal" value={nutrition.sugar} onChange={(event) => updateNutrition("sugar", event.target.value)} /></label>
        </div>
      </section>
      {error && <div className="inline-alert error" role="alert"><Info size={16} />{error}</div>}
      <div className="sheet-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button"><Check size={17} />Save changes</button></div>
    </form>
  </div>;
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

function SaveRecipeSheet({ meals, onSave, onClose }: { meals: Meal[]; onSave: (recipe: Recipe) => void; onClose: () => void }) {
  const [name, setName] = useState(`${mealLabels[meals[0]?.mealType || "breakfast"]} regulars`);
  const [selectedIds, setSelectedIds] = useState(() => meals.map((meal) => meal.id));
  const [titleLoading, setTitleLoading] = useState(false);
  const [titleError, setTitleError] = useState("");
  const selectedMeals = meals.filter((meal) => selectedIds.includes(meal.id));
  const nutrition = sumNutrition(selectedMeals.map((meal) => meal.nutrition));
  const toggle = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]);
  const suggestTitle = async () => {
    if (!selectedMeals.length || titleLoading) return;
    setTitleLoading(true); setTitleError("");
    try {
      const token = (await getSupabase()?.auth.getSession())?.data.session?.access_token;
      if (!token) throw new Error("Sign in to ask AI for a title.");
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: `Suggest one concise recipe title, 2 to 6 words, for a regular meal containing: ${selectedMeals.map((meal) => meal.name).join(", ")}. Return only the title, with no quotes, explanation, emoji, or grocery list.`,
          localDate: localDateKey(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const body: unknown = await response.json();
      const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
      if (!response.ok || typeof record.reply !== "string") throw new Error(typeof record.error === "string" ? record.error : "AI could not suggest a title.");
      const suggested = record.reply.split(/\r?\n/).map((line) => line.replace(/^\s*(?:title\s*:\s*|[-*•#]\s*)/i, "").replace(/^['"`]|['"`]$/g, "").trim()).find((line) => line && !/^grocery list:?$/i.test(line));
      if (!suggested) throw new Error("AI returned an empty title.");
      setName(suggested.slice(0, 240));
    } catch (error) {
      setTitleError(error instanceof Error ? error.message : "AI could not suggest a title.");
    } finally { setTitleLoading(false); }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || selectedMeals.length === 0) return;
    const now = new Date().toISOString();
    const ingredients: RecipeIngredient[] = selectedMeals.map((meal) => ({ id: `ingredient-${crypto.randomUUID()}`, name: meal.name, foodId: meal.foodId, amount: meal.amount, unit: meal.unit, grams: meal.grams, nutrition: meal.nutrition }));
    onSave({ id: `recipe-${crypto.randomUUID()}`, name: name.trim(), servings: 1, ingredients, nutritionPerServing: nutrition, createdAt: now, updatedAt: now });
  };
  return <div className="recipe-save-sheet"><div className="sheet-header"><div><span className="eyebrow">Save for next time</span><h2>Make this a recipe</h2></div><span /></div><form onSubmit={submit}><div className="recipe-name-field"><label htmlFor="recipe-name"><span>Recipe name</span><input id="recipe-name" autoFocus required value={name} maxLength={240} onChange={(event) => setName(event.target.value)} /></label><button type="button" className="secondary-button recipe-title-button" onClick={() => void suggestTitle()} disabled={!selectedMeals.length || titleLoading}><Sparkles size={16} />{titleLoading ? "Suggesting…" : "Suggest with AI"}</button></div>{titleError && <div className="inline-alert" role="status"><Info size={16} />{titleError}</div>}<fieldset className="recipe-ingredient-picker"><legend>What belongs in it?</legend>{meals.map((meal) => <label key={meal.id}><input type="checkbox" checked={selectedIds.includes(meal.id)} onChange={() => toggle(meal.id)} /><span><strong>{meal.name}</strong><small>{Math.round(meal.nutrition.calories)} kcal</small></span></label>)}</fieldset><div className="recipe-save-summary"><span>{selectedMeals.length} item{selectedMeals.length === 1 ? "" : "s"} · {Math.round(nutrition.calories)} kcal</span><small>You can replace individual items when you log it later.</small></div><div className="sheet-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={!selectedMeals.length}><BookOpen size={17} />Save recipe</button></div></form></div>;
}

export function RecipeLogSheet({ recipe, foods, onLog, onClose }: { recipe: Recipe; foods: Food[]; onLog: (meal: Meal) => Promise<void>; onClose: () => void }) {
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const logId = useRef(recipeLogId());
  const canLogIngredients = canLogRecipeIngredients(recipe);
  const sourceFood = (ingredient: RecipeIngredient) => recipeIngredientFood(ingredient, foods);
  const nutrition = recipeNutritionForLogging(recipe, foods, replacements);
  const buildMeal = (ingredient: RecipeIngredient): Meal => {
    const food = recipeIngredientFood(ingredient, foods, replacements[ingredient.id]);
    const grams = ingredient.grams || 100;
    const ingredientNutrition = recipeIngredientNutrition(ingredient, foods, replacements[ingredient.id]);
    return { id: `recipe-${crypto.randomUUID()}`, foodId: food?.id, recipeId: recipe.id, recipeLogId: logId.current, name: food?.name || ingredient.name, brand: food?.brand, mealType, amount: ingredient.amount || 1, unit: ingredient.unit || "serving", grams, nutrition: ingredientNutrition, createdAt: new Date().toISOString(), loggedDate: localDateKey(), source: food?.source || "custom" };
  };
  const log = async (event: FormEvent) => {
    event.preventDefault();
    if (canLogIngredients) {
      for (const ingredient of recipe.ingredients) await onLog(buildMeal(ingredient));
    } else {
      await onLog({ id: `recipe-${crypto.randomUUID()}`, recipeId: recipe.id, recipeLogId: logId.current, name: recipe.name, mealType, amount: 1, unit: "serving", grams: 100, nutrition: recipe.nutritionPerServing, createdAt: new Date().toISOString(), loggedDate: localDateKey(), source: "custom" });
    }
    onClose();
  };
  return <div className="recipe-log-sheet"><div className="sheet-header"><div><span className="eyebrow">Saved recipe</span><h2>{recipe.name}</h2></div><span /></div><form onSubmit={(event) => void log(event)}><p className="recipe-log-intro">{canLogIngredients ? "Review every food before adding this recipe to your daily log. Swaps update the total below." : "This recipe was saved as one nutrition entry."}</p><label className="meal-editor-form"><span>Add to</span><ThemedSelect ariaLabel="Recipe meal" value={mealType} onChange={(value) => setMealType(value as MealType)} options={(Object.keys(mealLabels) as MealType[]).map((type) => ({ value: type, label: mealLabels[type] }))} /></label>{canLogIngredients && <section className="recipe-log-ingredients" aria-labelledby="recipe-ingredients-heading"><h3 id="recipe-ingredients-heading">Foods in this recipe</h3>{recipe.ingredients.map((ingredient) => { const canSwap = Boolean(sourceFood(ingredient)); const ingredientNutrition = recipeIngredientNutrition(ingredient, foods, replacements[ingredient.id]); return <div className="recipe-log-ingredient" key={ingredient.id}><span><strong>{recipeIngredientFood(ingredient, foods, replacements[ingredient.id])?.name || ingredient.name}</strong><small>{Math.round(ingredientNutrition.calories)} kcal · P {round(ingredientNutrition.protein)}g · C {round(ingredientNutrition.carbs)}g · F {round(ingredientNutrition.fat)}g</small></span>{canSwap ? <label><span className="visually-hidden">Replace {ingredient.name}</span><ThemedSelect ariaLabel={`Replace ${ingredient.name}`} value={replacements[ingredient.id] || ingredient.foodId || ""} onChange={(value) => setReplacements((current) => ({ ...current, [ingredient.id]: value }))} options={[{ value: ingredient.foodId || "", label: "Keep this item" }, ...foods.filter((food) => food.id !== ingredient.foodId).slice(0, 40).map((food) => ({ value: food.id, label: `Swap for ${food.name}` }))]} /></label> : <small>Saved as a custom item</small>}</div>; })}</section>}<section className="recipe-log-total" aria-labelledby="recipe-total-heading"><div><span className="eyebrow">Recipe total</span><h3 id="recipe-total-heading">{Math.round(nutrition.calories)} kcal</h3></div><dl><div><dt>Protein</dt><dd>{round(nutrition.protein)}g</dd></div><div><dt>Carbs</dt><dd>{round(nutrition.carbs)}g</dd></div><div><dt>Fat</dt><dd>{round(nutrition.fat)}g</dd></div><div><dt>Fibre</dt><dd>{round(nutrition.fiber)}g</dd></div></dl></section><div className="sheet-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button"><Check size={17} />Log recipe</button></div></form></div>;
}

function MealAddRow({ mealType, meals, onAdd, onSaveRecipe }: { mealType: MealType; meals: Meal[]; onAdd: (mealType: MealType) => void; onSaveRecipe: (meals: Meal[]) => void }) {
  return <div className="meal-add-row"><button type="button" className="meal-add-primary" onClick={() => onAdd(mealType)}><span className="meal-add-icon"><Plus size={17} /></span><span>Add food to {mealLabels[mealType]}</span></button>{meals.length > 0 && <button type="button" className="meal-add-recipe" onClick={() => onSaveRecipe(meals)}><BookOpen size={16} /><span>Save {mealLabels[mealType].toLowerCase()} as recipe</span></button>}</div>;
}

function WaterTracker({ profile, dateKey, onSave }: { profile: Profile; dateKey: string; onSave: (profile: Profile) => void }) {
  const total = hydrationTotal(profile.waterEntries, dateKey);
  const target = profile.waterTargetMl || 2000;
  const setTotal = (amountMl: number) => onSave({ ...profile, waterEntries: setWaterAmount(profile.waterEntries, dateKey, amountMl) });
  return <section className="water-tracker rhythm-card card" aria-labelledby="water-heading">
    <header className="rhythm-card-heading"><span className="rhythm-icon water"><Droplets size={18} /></span><div><span className="eyebrow">Hydration</span><h2 id="water-heading">Water</h2></div><strong>{total.toLocaleString()}<small> / {target.toLocaleString()} ml</small></strong></header>
    <div className="habit-progress" role="progressbar" aria-label="Water logged today" aria-valuemin={0} aria-valuemax={target} aria-valuenow={total}><i style={{ width: `${Math.min(100, total / target * 100)}%` }} /></div>
    <div className="water-actions"><button type="button" className="icon-button subtle-button" onClick={() => setTotal(Math.max(0, total - 250))} aria-label="Remove 250 millilitres of water">−</button><button type="button" className="primary-button" onClick={() => setTotal(total + 250)}><Droplets size={16} />Add 250 ml</button><button type="button" className="secondary-button" onClick={() => setTotal(total + 500)}>+500 ml</button></div>
  </section>;
}

function FastingTracker({ profile, onSave }: { profile: Profile; onSave: (profile: Profile) => void }) {
  const [now, setNow] = useState(() => new Date().toISOString());
  const [expanded, setExpanded] = useState(Boolean(activeFast(profile.fastingRecords)));
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date().toISOString()), 60_000); return () => window.clearInterval(timer); }, []);
  const goal = profile.fastingGoalHours || 16;
  const active = activeFast(profile.fastingRecords);
  const progress = active ? fastingProgress(active.startedAt, now, goal) : 0;
  const elapsed = active ? fastingWindowHours(active.startedAt, now) : 0;
  return <details className={`fasting-tracker rhythm-card card${active ? " active" : ""}`} open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
    <summary className="fasting-summary"><span className="rhythm-icon fasting"><Timer size={18} /></span><span><span className="eyebrow">Automatic rhythm</span><strong id="fasting-heading">Fasting</strong><small>{active ? `${elapsed.toFixed(1)} of ${goal} hours` : `${goal}-hour plan · log a meal to begin`}</small></span><ChevronDown size={18} aria-hidden="true" /></summary>
    <div className="fasting-content" aria-labelledby="fasting-heading">
      {active ? <><div className="fasting-status"><strong>{elapsed.toFixed(1)}h</strong><span>of {goal}h fast</span></div><div className="habit-progress" role="progressbar" aria-label="Fasting goal progress" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={elapsed}><i style={{ width: `${progress * 100}%` }} /></div><p>Started after your last logged meal. Logging your next meal starts a new fast automatically.</p></> : <><p>Choose a tracking window. Fasting starts after your latest meal and never changes your food diary or calorie target.</p><div className="segmented fasting-goals" role="group" aria-label="Fasting tracking window">{fastingGoalHours.map((hours) => <button key={hours} type="button" aria-pressed={goal === hours} className={goal === hours ? "active" : ""} onClick={() => onSave({ ...profile, fastingGoalHours: hours })}>{hours} h</button>)}</div><small className="fasting-disclaimer">Tracking only, not a medical recommendation. If you have a health condition, take glucose-affecting medication, are pregnant or breastfeeding, or have a history of disordered eating, ask a clinician before fasting.</small></>}
    </div>
  </details>;
}

function DailyRhythm({ profile, dateKey, onSave }: { profile: Profile; dateKey: string; onSave: (profile: Profile) => void }) {
  const showWater = isHabitFeatureEnabled(profile.enabledHabitFeatures, habitFeatures.water);
  const showFasting = isHabitFeatureEnabled(profile.enabledHabitFeatures, habitFeatures.fasting);
  if (!showWater && !showFasting) return null;
  return <details className="daily-rhythm" aria-labelledby="daily-rhythm-heading">
    <summary><span><span className="eyebrow">Optional, after your food log</span><strong id="daily-rhythm-heading">Daily check-ins</strong></span><span className="daily-rhythm-summary"><span>{[showWater && "Water", showFasting && "Fasting"].filter(Boolean).join(" · ")}</span><ChevronDown size={17} aria-hidden="true" /></span></summary>
    <div className="daily-rhythm-grid">{showWater && <WaterTracker profile={profile} dateKey={dateKey} onSave={onSave} />}{showFasting && <FastingTracker profile={profile} onSave={onSave} />}</div>
  </details>;
}

export function TodayView({
  profile,
  meals,
  dateKey,
  onDateChange,
  onAdd,
  onOpenCoach,
  onDelete,
  onEdit,
  onOpenDetails,
  onOpenNutritionDetails,
  onOpenImage,
  onDropMeal,
  onDuplicate,
  onMove,
  syncLabel,
  showHomeScreenPrompt,
  onDismissHomeScreenPrompt,
  onOpenCalendar,
  onSaveProfile,
}: {
  profile: Profile;
  meals: Meal[];
  dateKey: string;
  onDateChange: (date: string) => void;
  onAdd: (mealType?: MealType) => void;
  onOpenCoach: () => void;
  onDelete: (id: string) => void;
  onEdit: (meal: Meal) => void;
  onOpenDetails: (meal: Meal) => void;
  onOpenNutritionDetails: () => void;
  onOpenImage: (meal: Meal) => void;
  onDropMeal: (meal: Meal, mealType: MealType, targetMealId?: string, insertAfter?: boolean) => void;
  onDuplicate: (meal: Meal) => void;
  onMove: (meal: Meal) => void;
  syncLabel: string;
  showHomeScreenPrompt: boolean;
  onDismissHomeScreenPrompt: () => void;
  onOpenCalendar: () => void;
  onSaveProfile: (profile: Profile) => void;
}) {
  const [recipeDraftMeals, setRecipeDraftMeals] = useState<Meal[]>();
  const [dropTarget, setDropTarget] = useState<string>();
  const [draggingMealId, setDraggingMealId] = useState<string>();
  const pointerDragRef = useRef<{ meal: Meal; pointerId: number; startX: number; startY: number; active: boolean; timerId?: number } | undefined>(undefined);
  const total = useMemo(() => sumNutrition(meals.map((meal) => meal.nutrition)), [meals]);
  const targets = resolveDailyTargets(profile, dateKey);
  const carbs = profile.carbDisplay === "net" ? netCarbs(total) : total.carbs;
  const remaining = Math.max(0, targets.calories - total.calories);
  const grouped = (Object.keys(mealLabels) as MealType[]).map((type) => ({ type, meals: meals.filter((meal) => meal.mealType === type) }));
  const updatePointerDropTarget = useCallback((clientX: number, clientY: number) => {
    const hovered = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-meal-id], [data-meal-list]");
    if (!hovered) { setDropTarget(undefined); return; }
    const mealId = hovered.dataset.mealId;
    const mealType = hovered.dataset.mealType || hovered.dataset.mealList;
    if (!mealType) { setDropTarget(undefined); return; }
    if (!mealId) { setDropTarget(mealType); return; }
    const rect = hovered.getBoundingClientRect();
    setDropTarget(`${mealType}:${mealId}:${clientY < rect.top + rect.height / 2 ? "before" : "after"}`);
  }, []);
  const finishPointerDrag = useCallback((clientX: number, clientY: number) => {
    const drag = pointerDragRef.current;
    if (!drag) return;
    if (drag.timerId) window.clearTimeout(drag.timerId);
    pointerDragRef.current = undefined;
    setDraggingMealId(undefined);
    setDropTarget(undefined);
    if (!drag.active) return;
    const hovered = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-meal-id], [data-meal-list]");
    const mealType = hovered?.dataset.mealType || hovered?.dataset.mealList;
    if (!mealType) return;
    const targetMealId = hovered?.dataset.mealId;
    const rect = hovered?.getBoundingClientRect();
    onDropMeal(drag.meal, mealType as MealType, targetMealId, Boolean(targetMealId && rect && clientY >= rect.top + rect.height / 2));
  }, [onDropMeal]);
  const cancelPointerDrag = useCallback(() => {
    const drag = pointerDragRef.current;
    if (drag?.timerId) window.clearTimeout(drag.timerId);
    pointerDragRef.current = undefined;
    setDraggingMealId(undefined);
    setDropTarget(undefined);
  }, []);
  const startPointerDrag = useCallback((meal: Meal, event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse") return;
    event.preventDefault();
    cancelPointerDrag();
    const drag: { meal: Meal; pointerId: number; startX: number; startY: number; active: boolean; timerId?: number } = { meal, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, active: false };
    drag.timerId = window.setTimeout(() => {
      if (pointerDragRef.current?.pointerId !== drag.pointerId) return;
      drag.active = true;
      setDraggingMealId(meal.id);
      updatePointerDropTarget(drag.startX, drag.startY);
    }, 220);
    pointerDragRef.current = drag;
    const move = (moveEvent: PointerEvent) => {
      const current = pointerDragRef.current;
      if (!current || current.pointerId !== moveEvent.pointerId) return;
      if (!current.active) {
        const distance = Math.hypot(moveEvent.clientX - current.startX, moveEvent.clientY - current.startY);
        if (distance > 10) cancelPointerDrag();
        return;
      }
      moveEvent.preventDefault();
      updatePointerDropTarget(moveEvent.clientX, moveEvent.clientY);
    };
    const end = (endEvent: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", cancel);
      finishPointerDrag(endEvent.clientX, endEvent.clientY);
    };
    const cancel = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", cancel);
      cancelPointerDrag();
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", cancel);
  }, [cancelPointerDrag, finishPointerDrag, updatePointerDropTarget]);
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
          {profile.hideCalories ? <div className="nutrition-focus"><span className="eyebrow">Today’s nutrients</span><strong>Focus on your macros</strong><p>Protein, carbs, fat and fibre stay visible. Energy numbers are hidden.</p></div> : <ProgressRing value={total.calories} target={targets.calories} nutrition={total} />}
          <div className="hero-stat-grid">
            {!profile.hideCalories && <div><span>Remaining</span><strong>{Math.round(remaining).toLocaleString()}</strong><small>kcal</small></div>}
            <div><span>Fibre</span><strong>{round(total.fiber, 0)}</strong><small>/ {targets.fiber} g</small></div>
          </div>
        </div>
        <div className="macro-card card">
          <div className="section-heading compact"><div><span className="eyebrow">Daily nutrition</span><h2>Macro totals</h2></div><span className="subtle">from food & drinks</span></div>
          <div className="macro-total-grid"><div><span>Protein</span><strong>{round(total.protein)}<small>g</small></strong></div><div><span>{profile.carbDisplay === "net" ? "Net carbs" : "Carbs"}</span><strong>{round(carbs)}<small>g</small></strong></div><div><span>Fat</span><strong>{round(total.fat)}<small>g</small></strong></div></div>
          <button type="button" className="macro-expand-trigger" onClick={onOpenNutritionDetails}><span>See full nutrition details</span><span className="macro-expand-hint"><span>View details</span><ChevronDown size={17} aria-hidden="true" /></span></button>
        </div>
      </section>

      <section className="log-section">
        <div className="section-heading"><div><span className="eyebrow">Daily log</span><h2>Your meals</h2></div><span className="subtle meal-reorder-hint">Hold ⋮⋮ to reorder</span></div>
        {grouped.map(({ type, meals: groupMeals }) => (
          <div className="meal-group" key={type}>
            <div className="meal-group-title"><span>{mealLabels[type]}</span>{!profile.hideCalories && (() => { const target = resolveMealCalorieTarget(profile, type); const calories = Math.round(sumNutrition(groupMeals.map((meal) => meal.nutrition)).calories); return <span aria-label={target ? `${calories} of ${target} calorie guide` : `${calories} calories`}>{calories}{target ? ` / ${target}` : ""} kcal</span>; })()}</div>
            <div className={`meal-list card ${dropTarget === type ? "drop-target" : ""}`} data-meal-list={type} onDragOver={(event) => { event.preventDefault(); setDropTarget(type); }} onDragLeave={() => setDropTarget(undefined)} onDrop={(event) => { event.preventDefault(); const mealId = event.dataTransfer.getData("text/meal-id"); const meal = meals.find((candidate) => candidate.id === mealId); if (meal) onDropMeal(meal, type); setDropTarget(undefined); }}>
              {groupMeals.map((meal) => <MealRow key={meal.id} meal={meal} hideCalories={profile.hideCalories} dragging={draggingMealId === meal.id} onPointerDown={startPointerDrag} onOpenImage={() => onOpenImage(meal)} dropPosition={dropTarget === `${type}:${meal.id}:before` ? "before" : dropTarget === `${type}:${meal.id}:after` ? "after" : undefined} onDelete={() => onDelete(meal.id)} onEdit={() => onEdit(meal)} onDetails={() => onOpenDetails(meal)} onDuplicate={() => onDuplicate(meal)} onMove={() => onMove(meal)} onDragStart={(draggedMeal, event) => { event.dataTransfer.setData("text/meal-id", draggedMeal.id); event.dataTransfer.effectAllowed = "move"; }} onDragOver={(event) => { event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); setDropTarget(`${type}:${meal.id}:${event.clientY < rect.top + rect.height / 2 ? "before" : "after"}`); }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const mealId = event.dataTransfer.getData("text/meal-id"); const draggedMeal = meals.find((candidate) => candidate.id === mealId); if (draggedMeal) { const rect = event.currentTarget.getBoundingClientRect(); onDropMeal(draggedMeal, type, meal.id, event.clientY >= rect.top + rect.height / 2); } setDropTarget(undefined); }} />)}
              <MealAddRow mealType={type} meals={groupMeals} onAdd={onAdd} onSaveRecipe={setRecipeDraftMeals} />
            </div>
          </div>
        ))}
        <DailyRhythm profile={profile} dateKey={dateKey} onSave={onSaveProfile} />
      </section>

      <button className="coach-check-in" onClick={onOpenCoach}>
        <span className="action-icon mint"><MessageCircle size={19} /></span>
        <span><strong>Ask Coach about today</strong><small>Get guidance with your diary in context</small></span>
        <ChevronRight size={18} />
      </button>
      {recipeDraftMeals && <Sheet onClose={() => setRecipeDraftMeals(undefined)} label="Save meal as recipe"><SaveRecipeSheet meals={recipeDraftMeals} onSave={(recipe) => { onSaveProfile({ ...profile, recipes: [...(profile.recipes || []), recipe] }); setRecipeDraftMeals(undefined); }} onClose={() => setRecipeDraftMeals(undefined)} /></Sheet>}
    </main>
  );
}

export function CalendarSheet({ dateKey, meals, profile, onDateChange, onClose }: { dateKey: string; meals: Meal[]; profile: Profile; onDateChange: (date: string) => void; onClose: () => void }) {
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
    <div className="sheet-header"><div><span className="eyebrow">Your diary</span><h2>Month at a glance</h2></div><span /></div>
    <p className="calendar-intro">Tap a day to jump to its log. Rings show how close you were to your daily guide.</p>
    <div className="calendar-toolbar"><button className="icon-button ghost" onClick={previousMonth} aria-label="Previous month"><ChevronLeft /></button><strong>{monthTitle}</strong><button className="icon-button ghost" onClick={nextMonth} disabled={monthStart.getFullYear() === new Date(`${today}T12:00:00`).getFullYear() && monthStart.getMonth() >= new Date(`${today}T12:00:00`).getMonth()} aria-label="Next month"><ChevronRight /></button></div>
    <div className="calendar-weekdays" aria-hidden="true">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div>
    <div className="calendar-grid" role="grid" aria-label={monthTitle}>
      {calendarDays.map((key, index) => key ? (() => {
        const total = totalsByDate.get(key);
        const isFuture = key > today;
        const isSelected = key === dateKey;
        const progressValue = profile.hideCalories ? total?.protein || 0 : total?.calories || 0;
        const targets = resolveDailyTargets(profile, key);
        const progressTarget = profile.hideCalories ? targets.protein : targets.calories;
        return <button key={key} className={`calendar-day ${isSelected ? "selected" : ""} ${total ? "logged" : ""}`} role="gridcell" onClick={() => chooseDate(key)} disabled={isFuture} aria-label={`${new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric" })}${total ? `, ${Math.round(progressValue)} of ${progressTarget} ${profile.hideCalories ? "grams protein" : "calories"}` : ", no meals logged"}`}>
          <span>{new Date(`${key}T12:00:00`).getDate()}</span>{total && <MiniProgressRing value={progressValue} target={progressTarget} label="" />}
        </button>;
      })() : <span className="calendar-day empty" key={`empty-${index}`} aria-hidden="true" />)}
    </div>
    <div className="calendar-legend"><span><i className="legend-ring" /> Logged day</span><span><i className="legend-selected" /> Selected</span>{!profile.hideCalories && <small>Uses each day’s target</small>}</div>
  </div>;
}
