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
import { mealLabels, ProgressRing } from "./DiaryPrimitives";
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
      const remaining = 1 - imageUrls.length;
      if (remaining <= 0) throw new Error("A recipe can include 1 photo.");
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
  return <div className="recipe-save-sheet"><div className="sheet-header"><div><span className="eyebrow">Save for next time</span><h2>Make this a recipe</h2></div><span /></div><form onSubmit={(event) => void submit(event)}><div className="recipe-name-field"><label htmlFor="recipe-name"><span>Recipe name</span><input id="recipe-name" autoFocus required value={name} maxLength={240} onChange={(event) => setName(event.target.value)} placeholder="e.g. Weeknight lentil bowl" /></label><button type="button" className="secondary-button recipe-title-button" onClick={() => void suggestTitle()} disabled={!selectedMeals.length || titleLoading}><Sparkles size={16} />{titleLoading ? "Suggesting…" : "Suggest with AI"}</button></div>{titleError && <div className="inline-alert" role="status"><Info size={16} />{titleError}</div>}<fieldset className="recipe-ingredient-picker"><legend>What belongs in it?</legend>{meals.map((meal) => <label key={meal.id}><input type="checkbox" checked={selectedIds.includes(meal.id)} onChange={() => toggle(meal.id)} /><span><strong>{meal.name}</strong><small>{Math.round(meal.nutrition.calories)} kcal</small></span></label>)}</fieldset><label className="recipe-photo-upload"><input className="visually-hidden-file" type="file" accept="image/*" onChange={(event) => { void addImages(event.target.files); event.currentTarget.value = ""; }} /><span className="action-icon mint"><ImagePlus size={17} /></span><span><strong>Add photo</strong><small>Optional · 1 photo</small></span></label>{imageUrls.length > 0 && <div className="recipe-photo-preview" aria-label={`${imageUrls.length} recipe photos`}>{imageUrls.map((url, index) => <span key={url}><img src={url} alt={`Recipe photo ${index + 1}`} /><button type="button" onClick={() => setImageUrls((current) => current.filter((candidate) => candidate !== url))} aria-label={`Remove recipe photo ${index + 1}`}><X size={14} /></button></span>)}</div>}{imageError && <div className="inline-alert" role="status"><Info size={16} />{imageError}</div>}<div className="recipe-save-summary"><span>{selectedMeals.length} item{selectedMeals.length === 1 ? "" : "s"} · {Math.round(nutrition.calories)} kcal</span><small>Saving packages these items into one recipe entry in today’s log.</small></div><div className="sheet-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={!selectedMeals.length || saving}><BookOpen size={17} />{saving ? "Saving…" : "Save recipe"}</button></div></form></div>;
}

export function RecipeLogSheet({ recipe, foods, meals, onSaveFood, onLog, onSaveRecipe, onSaveEdit, editingMeal, onClose }: { recipe: Recipe; foods: Food[]; meals: Meal[]; onSaveFood: (food: Food) => Promise<void>; onLog: (meal: Meal) => Promise<void>; onSaveRecipe?: (recipe: Recipe) => Promise<void>; onSaveEdit?: (meal: Meal, recipe: Recipe) => Promise<void>; editingMeal?: Meal; onClose: () => void }) {
  const [mealType, setMealType] = useState<MealType>(editingMeal?.mealType || "breakfast");
  const [loggedDate, setLoggedDate] = useState(editingMeal?.loggedDate || localDateKey());
  const [ingredients, setIngredients] = useState(recipe.ingredients);
  const [pickingIngredient, setPickingIngredient] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>(() => recipe.imageUrls?.length ? [...recipe.imageUrls] : editingMeal?.imageUrl ? [editingMeal.imageUrl] : []);
  const [imageError, setImageError] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const logId = useRef(recipeLogId());
  const nutrition = ingredients.length || recipe.ingredients.length ? sumNutrition(ingredients.map((ingredient) => recipeIngredientNutrition(ingredient, foods))) : recipe.nutritionPerServing;
  const addIngredient = (food: Food) => { setIngredients((current) => [...current, { id: `ingredient-${crypto.randomUUID()}`, name: food.name, foodId: food.id, amount: 1, unit: "100g", grams: 100, nutrition: food.nutrientsPer100 }]); setPickingIngredient(false); };
  const removeIngredient = (ingredient: RecipeIngredient) => {
    if (!window.confirm(`Remove ${ingredient.name} from this recipe?`)) return;
    setIngredients((current) => current.filter((candidate) => candidate.id !== ingredient.id));
  };
  const addPhoto = async (file: File | undefined) => { if (!file) return; try { setImageUrls([await readMealImage(file)]); setImageError(""); } catch (error) { setImageError(error instanceof Error ? error.message : "The photo could not be added."); } };
  const log = async (event: FormEvent) => {
    event.preventDefault();
    if (!ingredients.length) return;
    if (editingMeal && onSaveEdit) {
      const nextRecipe: Recipe = { ...recipe, ingredients, nutritionPerServing: nutrition, imageUrls, updatedAt: new Date().toISOString() };
      await onSaveEdit({ ...editingMeal, mealType, loggedDate, nutrition, imageUrl: imageUrls[0] }, nextRecipe);
    } else {
      const createdAt = loggedDate === localDateKey() ? new Date().toISOString() : new Date(`${loggedDate}T12:00:00`).toISOString();
      if (onSaveRecipe) await onSaveRecipe({ ...recipe, ingredients, nutritionPerServing: nutrition, imageUrls, updatedAt: new Date().toISOString() });
      await onLog({ id: `recipe-${crypto.randomUUID()}`, recipeId: recipe.id, recipeLogId: logId.current, name: recipe.name, mealType, amount: 1, unit: "serving", grams: 100, nutrition, imageUrl: imageUrls[0], createdAt, loggedDate, source: "custom" });
    }
    onClose();
  };
  if (pickingIngredient) return <div className="recipe-log-sheet"><div className="sheet-header"><button className="icon-button ghost" type="button" onClick={() => setPickingIngredient(false)} aria-label="Back to recipe"><ChevronDown /></button><div><span className="eyebrow">Recipe ingredient</span><h2>Add a food</h2></div><span /></div><AddFoodSheet foods={foods} meals={meals} recipes={[]} hideCalories={false} onSelectFood={addIngredient} onSelectRecipe={() => undefined} onSaveFood={onSaveFood} onLog={async () => undefined} onMealPhoto={() => undefined} /></div>;
  return <div className="recipe-log-sheet"><div className="sheet-header"><div><span className="eyebrow">{editingMeal ? "Edit recipe" : "Saved recipe"}</span><h2>{recipe.name}</h2></div><span /></div><form onSubmit={(event) => void log(event)}><p className="recipe-log-intro">{editingMeal ? "Update the foods and photo for this recipe entry." : "Adjust this serving before logging it."}</p><div className="recipe-log-where"><label className="meal-editor-form"><span>{editingMeal ? "Meal" : "Log to"}</span><ThemedSelect ariaLabel="Recipe meal" value={mealType} onChange={(value) => setMealType(value as MealType)} options={(Object.keys(mealLabels) as MealType[]).map((type) => ({ value: type, label: mealLabels[type] }))} /></label><label className="recipe-date-field"><span>Date</span><input type="date" required value={loggedDate} onChange={(event) => setLoggedDate(event.target.value)} /></label></div><section className="recipe-log-ingredients" aria-labelledby="recipe-ingredients-heading"><div className="detail-section-heading"><div><h3 id="recipe-ingredients-heading">Recipe foods</h3><span>{ingredients.length} item{ingredients.length === 1 ? "" : "s"}</span></div><button className="text-button" type="button" onClick={() => setPickingIngredient(true)}><Plus size={15} />Add food</button></div>{ingredients.length ? ingredients.map((ingredient) => <div className="recipe-log-ingredient" key={ingredient.id}><span><strong>{ingredient.name}</strong><small>{Math.round(recipeIngredientNutrition(ingredient, foods).calories)} kcal</small></span><button type="button" className="icon-button ghost recipe-remove-ingredient" onClick={() => removeIngredient(ingredient)} aria-label={`Remove ${ingredient.name}`} title={`Remove ${ingredient.name}`}><X size={17} /></button></div>) : <p className="detail-empty">No foods yet. Add a food to build this recipe.</p>}</section><section className="meal-photo-editor recipe-photo-editor" aria-labelledby="recipe-photo-heading"><div><span className="eyebrow" id="recipe-photo-heading">Recipe photo</span><small>Optional. Stored privately with this recipe.</small></div>{imageUrls[0] ? <div className="meal-photo-preview"><img src={imageUrls[0]} alt={`Preview of ${recipe.name}`} /><div><strong>Photo added</strong><button type="button" className="secondary-button" onClick={() => imageInputRef.current?.click()}>Replace photo</button><button type="button" className="text-button muted" onClick={() => setImageUrls([])}>Remove</button></div></div> : <button type="button" className="meal-photo-upload" onClick={() => imageInputRef.current?.click()}><span className="meal-photo-upload-icon"><ImagePlus size={19} /></span><span className="meal-photo-upload-copy"><strong>Add a recipe photo</strong><small>Choose from your device</small></span></button>}<input ref={imageInputRef} type="file" accept="image/*" hidden onChange={(event) => { void addPhoto(event.target.files?.[0]); event.target.value = ""; }} />{imageError && <div className="inline-alert error" role="alert"><Info size={16} />{imageError}</div>}</section><section className="recipe-log-total" aria-labelledby="recipe-total-heading"><div className="recipe-log-total-heading"><span className="eyebrow">{editingMeal ? "Updated nutrition" : "Nutrition for this serving"}</span><h3 id="recipe-total-heading">See the full recipe at a glance</h3></div><ProgressRing value={nutrition.calories} target={Math.max(1, nutrition.calories)} nutrition={nutrition} eyebrow="Recipe total" targetText="1 serving" targetContext="recipe serving" /><dl><div><dt>Protein</dt><dd>{round(nutrition.protein)}g</dd></div><div><dt>Carbs</dt><dd>{round(nutrition.carbs)}g</dd></div><div><dt>Fat</dt><dd>{round(nutrition.fat)}g</dd></div><div><dt>Fibre</dt><dd>{round(nutrition.fiber)}g</dd></div></dl></section><div className="sheet-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button"><Check size={17} />{editingMeal ? "Save recipe" : "Log recipe"}</button></div></form></div>;
}

export function MealAddRow({ mealType, meals, onAdd, onSaveRecipe }: { mealType: MealType; meals: Meal[]; onAdd: (mealType: MealType) => void; onSaveRecipe: (meals: Meal[]) => void }) {
  const foodMeals = meals.filter((meal) => !meal.recipeId);
  const canCombine = foodMeals.length > 1;
  return <div className="meal-add-row"><button type="button" className="meal-add-primary" onClick={() => onAdd(mealType)}><span className="meal-add-icon"><Plus size={17} /></span><span>Add food to {mealLabels[mealType]}</span></button>{canCombine && <button type="button" className="meal-add-recipe" onClick={() => onSaveRecipe(foodMeals)} aria-label={`Combine foods in ${mealLabels[mealType].toLowerCase()} into a recipe`}><BookOpen size={17} /><span className="meal-add-recipe-copy"><strong>Combine into a recipe</strong><small>Choose foods to save together</small></span></button>}</div>;
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
