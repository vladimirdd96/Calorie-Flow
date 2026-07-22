"use client";

import { BookOpen, ChevronDown, Check, Droplets, ImagePlus, Info, Plus, Share2, Sparkles, Timer, X } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { ThemedSelect } from "@/features/shared/ThemedSelect";
import { activeFast, fastingProgress, fastingWindowHours } from "@/lib/fasting";
import { isHabitFeatureEnabled } from "@/lib/habit-settings";
import { hydrationTotal, setWaterAmount } from "@/lib/hydration";
import { localDateKey, round, sumNutrition } from "@/lib/nutrition";
import { getSupabase } from "@/lib/supabase";
import type { Food, Meal, MealType, Profile, Recipe, RecipeIngredient } from "@/lib/types";
import { fastingGoalHours, habitFeatures } from "@/lib/types";
import { recipeIngredientNutrition, recipeLogId } from "@/features/recipes/recipeLogging";
import { AddFoodSheet } from "@/features/food-capture/FoodCapture";
import { mealLabels } from "./DiaryPrimitives";
import { readMealImage } from "./DiaryPrimitives";

export function HomeScreenPrompt({ onDismiss }: { onDismiss: () => void }) {
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

export function SaveRecipeSheet({ meals, onSave, onClose }: { meals: Meal[]; onSave: (recipe: Recipe, selectedMeals: Meal[]) => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState(`${mealLabels[meals[0]?.mealType || "breakfast"]} regulars`);
  const [selectedIds, setSelectedIds] = useState(() => meals.map((meal) => meal.id));
  const [titleLoading, setTitleLoading] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>(() => [...new Set(meals.flatMap((meal) => meal.imageUrl ? [meal.imageUrl] : []))].slice(0, 8));
  const [imageError, setImageError] = useState("");
  const [saving, setSaving] = useState(false);
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
  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setImageError("");
    try {
      const remaining = 8 - imageUrls.length;
      if (remaining <= 0) throw new Error("A recipe can include up to 8 photos.");
      const images = await Promise.all([...files].slice(0, remaining).map(readMealImage));
      setImageUrls((current) => [...current, ...images]);
    } catch (error) { setImageError(error instanceof Error ? error.message : "The photo could not be added."); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || selectedMeals.length === 0 || saving) return;
    setSaving(true);
    const now = new Date().toISOString();
    const ingredients: RecipeIngredient[] = selectedMeals.map((meal) => ({ id: `ingredient-${crypto.randomUUID()}`, name: meal.name, foodId: meal.foodId, amount: meal.amount, unit: meal.unit, grams: meal.grams, nutrition: meal.nutrition }));
    try { await onSave({ id: `recipe-${crypto.randomUUID()}`, name: name.trim(), servings: 1, ingredients, nutritionPerServing: nutrition, imageUrls, createdAt: now, updatedAt: now }, selectedMeals); } finally { setSaving(false); }
  };
  return <div className="recipe-save-sheet"><div className="sheet-header"><div><span className="eyebrow">Save for next time</span><h2>Make this a recipe</h2></div><span /></div><form onSubmit={(event) => void submit(event)}><div className="recipe-name-field"><label htmlFor="recipe-name"><span>Recipe name</span><input id="recipe-name" autoFocus required value={name} maxLength={240} onChange={(event) => setName(event.target.value)} /></label><button type="button" className="secondary-button recipe-title-button" onClick={() => void suggestTitle()} disabled={!selectedMeals.length || titleLoading}><Sparkles size={16} />{titleLoading ? "Suggesting…" : "Suggest with AI"}</button></div>{titleError && <div className="inline-alert" role="status"><Info size={16} />{titleError}</div>}<fieldset className="recipe-ingredient-picker"><legend>What belongs in it?</legend>{meals.map((meal) => <label key={meal.id}><input type="checkbox" checked={selectedIds.includes(meal.id)} onChange={() => toggle(meal.id)} /><span><strong>{meal.name}</strong><small>{Math.round(meal.nutrition.calories)} kcal</small></span></label>)}</fieldset><label className="recipe-photo-upload"><input className="visually-hidden-file" type="file" accept="image/*" multiple onChange={(event) => { void addImages(event.target.files); event.currentTarget.value = ""; }} /><span className="action-icon mint"><ImagePlus size={17} /></span><span><strong>Add photos</strong><small>Optional · up to 8</small></span></label>{imageUrls.length > 0 && <div className="recipe-photo-preview" aria-label={`${imageUrls.length} recipe photos`}>{imageUrls.map((url, index) => <span key={url}><img src={url} alt={`Recipe photo ${index + 1}`} /><button type="button" onClick={() => setImageUrls((current) => current.filter((candidate) => candidate !== url))} aria-label={`Remove recipe photo ${index + 1}`}><X size={14} /></button></span>)}</div>}{imageError && <div className="inline-alert" role="status"><Info size={16} />{imageError}</div>}<div className="recipe-save-summary"><span>{selectedMeals.length} item{selectedMeals.length === 1 ? "" : "s"} · {Math.round(nutrition.calories)} kcal</span><small>Saving packages these items into one recipe entry in today’s log.</small></div><div className="sheet-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={!selectedMeals.length || saving}><BookOpen size={17} />{saving ? "Saving…" : "Save recipe"}</button></div></form></div>;
}

export function RecipeLogSheet({ recipe, foods, meals, onSaveFood, onLog, onClose }: { recipe: Recipe; foods: Food[]; meals: Meal[]; onSaveFood: (food: Food) => Promise<void>; onLog: (meal: Meal) => Promise<void>; onClose: () => void }) {
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [ingredients, setIngredients] = useState(recipe.ingredients);
  const [pickingIngredient, setPickingIngredient] = useState(false);
  const logId = useRef(recipeLogId());
  const nutrition = ingredients.length ? sumNutrition(ingredients.map((ingredient) => recipeIngredientNutrition(ingredient, foods))) : recipe.nutritionPerServing;
  const replaceIngredient = (ingredientId: string, food: Food) => setIngredients((current) => current.map((ingredient) => ingredient.id === ingredientId ? { ...ingredient, name: food.name, foodId: food.id, grams: ingredient.grams || 100, nutrition: recipeIngredientNutrition({ ...ingredient, foodId: food.id, nutrition: undefined }, foods) } : ingredient));
  const addIngredient = (food: Food) => { setIngredients((current) => [...current, { id: `ingredient-${crypto.randomUUID()}`, name: food.name, foodId: food.id, amount: 1, unit: "100g", grams: 100, nutrition: food.nutrientsPer100 }]); setPickingIngredient(false); };
  const log = async (event: FormEvent) => {
    event.preventDefault();
    await onLog({ id: `recipe-${crypto.randomUUID()}`, recipeId: recipe.id, recipeLogId: logId.current, name: recipe.name, mealType, amount: 1, unit: "serving", grams: 100, nutrition, imageUrl: recipe.imageUrls?.[0], createdAt: new Date().toISOString(), loggedDate: localDateKey(), source: "custom" });
    onClose();
  };
  if (pickingIngredient) return <div className="recipe-log-sheet"><div className="sheet-header"><button className="icon-button ghost" type="button" onClick={() => setPickingIngredient(false)} aria-label="Back to recipe"><ChevronDown /></button><div><span className="eyebrow">Recipe ingredient</span><h2>Add a food</h2></div><span /></div><AddFoodSheet foods={foods} meals={meals} recipes={[]} hideCalories={false} selectionOnly onSelectFood={addIngredient} onSelectRecipe={() => undefined} onSaveFood={onSaveFood} onLog={async () => undefined} onMealPhoto={() => undefined} /></div>;
  return <div className="recipe-log-sheet"><div className="sheet-header"><div><span className="eyebrow">Saved recipe</span><h2>{recipe.name}</h2></div><span /></div><form onSubmit={(event) => void log(event)}><p className="recipe-log-intro">Adjust this serving for today. Your saved recipe stays unchanged.</p><label className="meal-editor-form"><span>Add to</span><ThemedSelect ariaLabel="Recipe meal" value={mealType} onChange={(value) => setMealType(value as MealType)} options={(Object.keys(mealLabels) as MealType[]).map((type) => ({ value: type, label: mealLabels[type] }))} /></label><section className="recipe-log-ingredients" aria-labelledby="recipe-ingredients-heading"><div className="detail-section-heading"><h3 id="recipe-ingredients-heading">Foods in this recipe</h3><button className="text-button" type="button" onClick={() => setPickingIngredient(true)}><Plus size={15} />Add food</button></div>{ingredients.map((ingredient) => <div className="recipe-log-ingredient" key={ingredient.id}><span><strong>{ingredient.name}</strong><small>{Math.round(recipeIngredientNutrition(ingredient, foods).calories)} kcal</small></span><ThemedSelect ariaLabel={`Replace ${ingredient.name}`} value={ingredient.foodId || ""} onChange={(value) => { const food = foods.find((candidate) => candidate.id === value); if (food) replaceIngredient(ingredient.id, food); }} options={[{ value: ingredient.foodId || "", label: "Keep or replace" }, ...foods.slice(0, 80).map((food) => ({ value: food.id, label: `Use ${food.name}` }))]} /></div>)}</section><section className="recipe-log-total" aria-labelledby="recipe-total-heading"><div><span className="eyebrow">Today’s recipe total</span><h3 id="recipe-total-heading">{Math.round(nutrition.calories)} kcal</h3></div><dl><div><dt>Protein</dt><dd>{round(nutrition.protein)}g</dd></div><div><dt>Carbs</dt><dd>{round(nutrition.carbs)}g</dd></div><div><dt>Fat</dt><dd>{round(nutrition.fat)}g</dd></div><div><dt>Fibre</dt><dd>{round(nutrition.fiber)}g</dd></div></dl></section><div className="sheet-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button"><Check size={17} />Log recipe</button></div></form></div>;
}

export function MealAddRow({ mealType, meals, onAdd, onSaveRecipe }: { mealType: MealType; meals: Meal[]; onAdd: (mealType: MealType) => void; onSaveRecipe: (meals: Meal[]) => void }) {
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

export function DailyRhythm({ profile, dateKey, onSave }: { profile: Profile; dateKey: string; onSave: (profile: Profile) => void }) {
  const showWater = isHabitFeatureEnabled(profile.enabledHabitFeatures, habitFeatures.water);
  const showFasting = isHabitFeatureEnabled(profile.enabledHabitFeatures, habitFeatures.fasting);
  if (!showWater && !showFasting) return null;
  return <details className="daily-rhythm" aria-labelledby="daily-rhythm-heading">
    <summary><span><span className="eyebrow">Optional, after your food log</span><strong id="daily-rhythm-heading">Daily check-ins</strong></span><span className="daily-rhythm-summary"><span>{[showWater && "Water", showFasting && "Fasting"].filter(Boolean).join(" · ")}</span><ChevronDown size={17} aria-hidden="true" /></span></summary>
    <div className="daily-rhythm-grid">{showWater && <WaterTracker profile={profile} dateKey={dateKey} onSave={onSave} />}{showFasting && <FastingTracker profile={profile} onSave={onSave} />}</div>
  </details>;
}
