"use client";

import { ChevronDown, BookOpen, CalendarPlus, ImagePlus, ListChecks, Pencil, Plus, Trash2, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { ThemedSelect } from "@/features/shared/ThemedSelect";
import { NumericInput } from "@/features/shared/NumericInput";
import { Sheet } from "@/features/shared/Sheet";
import { RecipeLogSheet, readMealImage } from "@/features/diary/DiaryView";
import { localDateKey } from "@/lib/nutrition";
import { groceryItemsForPlan } from "@/lib/planning";
import type { Food, Meal, MealType, Profile, Recipe } from "@/lib/types";

const mealLabels: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

function RecipeComposer({ recipe, onSave }: { recipe?: Recipe; onSave: (recipe: Recipe) => void }) {
  const [name, setName] = useState(recipe?.name || "");
  const [ingredients, setIngredients] = useState(recipe?.ingredients.map((ingredient) => ingredient.name).join("\n") || "");
  const [servings, setServings] = useState(String(recipe?.servings || 2));
  const [nutrition, setNutrition] = useState({ calories: String(recipe?.nutritionPerServing.calories ?? 400), protein: String(recipe?.nutritionPerServing.protein ?? 25), carbs: String(recipe?.nutritionPerServing.carbs ?? 45), fat: String(recipe?.nutritionPerServing.fat ?? 12), fiber: String(recipe?.nutritionPerServing.fiber ?? 8), sugar: String(recipe?.nutritionPerServing.sugar ?? 6) });
  const [imageUrls, setImageUrls] = useState(recipe?.imageUrls || []);
  const [imageError, setImageError] = useState("");
  const setNutrient = (key: keyof typeof nutrition, value: string) => setNutrition((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Object.fromEntries(Object.entries(nutrition).map(([key, value]) => [key, Number(value)])) as Record<keyof typeof nutrition, number>;
    const ingredientNames = ingredients.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
    if (!name.trim() || !Number.isFinite(Number(servings)) || Number(servings) <= 0 || ingredientNames.length === 0 || Object.values(values).some((value) => !Number.isFinite(value) || value < 0)) return;
    const now = new Date().toISOString();
    onSave({ id: recipe?.id || `recipe-${crypto.randomUUID()}`, name: name.trim(), servings: Number(servings), ingredients: ingredientNames.map((item, index) => ({ ...recipe?.ingredients[index], id: recipe?.ingredients[index]?.id || `ingredient-${crypto.randomUUID()}`, name: item })), nutritionPerServing: values, imageUrls, createdAt: recipe?.createdAt || now, updatedAt: now });
    setName(""); setIngredients(""); setServings("2"); setNutrition({ calories: "400", protein: "25", carbs: "45", fat: "12", fiber: "8", sugar: "6" });
  };
  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setImageError("");
    try { const remaining = 1 - imageUrls.length; if (remaining <= 0) throw new Error("A recipe can include 1 photo."); const images = await Promise.all([...files].slice(0, remaining).map(readMealImage)); setImageUrls((current) => [...current, ...images]); } catch (error) { setImageError(error instanceof Error ? error.message : "The photo could not be added."); }
  };
  return <form className="recipe-composer" onSubmit={submit}>
    <div className="form-grid two"><label className="span-two"><span>Recipe name</span><input required value={name} maxLength={240} onChange={(event) => setName(event.target.value)} placeholder="e.g. Weeknight lentil bowl" /></label><label><span>Servings</span><NumericInput required min="0.5" max="100" step="0.5" value={servings} onChange={(event) => setServings(event.target.value)} /></label><label><span>Ingredients</span><textarea required value={ingredients} maxLength={5000} onChange={(event) => setIngredients(event.target.value)} placeholder="One ingredient per line" /></label></div>
    <div className="recipe-nutrition"><span className="eyebrow">Per serving</span><div className="form-grid three">{(["calories", "protein", "carbs", "fat", "fiber", "sugar"] as const).map((key) => <label key={key}><span>{key === "fiber" ? "Fibre" : key[0].toUpperCase() + key.slice(1)}</span><NumericInput required min="0" step="0.1" value={nutrition[key]} onChange={(event) => setNutrient(key, event.target.value)} /></label>)}</div></div>
    <label className="recipe-photo-upload"><input className="visually-hidden-file" type="file" accept="image/*" onChange={(event) => { void addImages(event.target.files); event.currentTarget.value = ""; }} /><span className="action-icon mint"><ImagePlus size={17} /></span><span><strong>Add photo</strong><small>Optional · 1 photo</small></span></label>{imageUrls.length > 0 && <div className="recipe-photo-preview" aria-label={`${imageUrls.length} recipe photos`}>{imageUrls.map((url, index) => <span key={url}><img src={url} alt={`Recipe photo ${index + 1}`} /><button type="button" onClick={() => setImageUrls((current) => current.filter((candidate) => candidate !== url))} aria-label={`Remove recipe photo ${index + 1}`}><X size={14} /></button></span>)}</div>}{imageError && <div className="inline-alert" role="status">{imageError}</div>}
    <button className="primary-button" type="submit"><BookOpen size={17} />{recipe ? "Save changes" : "Save recipe"}</button>
  </form>;
}

export function PlanView({ profile, foods, meals, onSaveFood, onSave, onLog }: { profile: Profile; foods: Food[]; meals: Meal[]; onSaveFood: (food: Food) => Promise<void>; onSave: (profile: Profile) => void; onLog: (meal: Meal) => Promise<void> }) {
  const recipes = profile.recipes || [];
  const entries = (profile.mealPlanEntries || []).filter((entry) => recipes.some((recipe) => recipe.id === entry.recipeId)).sort((a, b) => a.date.localeCompare(b.date));
  const [recipeComposerOpen, setRecipeComposerOpen] = useState(false);
  const [recipeId, setRecipeId] = useState("");
  const [date, setDate] = useState(localDateKey());
  const [mealType, setMealType] = useState<MealType>("dinner");
  const [section, setSection] = useState<"week" | "recipes" | "shopping">("week");
  const [loggingRecipe, setLoggingRecipe] = useState<Recipe>();
  const [editingRecipe, setEditingRecipe] = useState<Recipe>();
  const [deletingRecipe, setDeletingRecipe] = useState<Recipe>();
  const addRecipe = (recipe: Recipe) => onSave({ ...profile, recipes: [...recipes, recipe] });
  const saveRecipe = (recipe: Recipe) => onSave({ ...profile, recipes: recipes.map((item) => item.id === recipe.id ? recipe : item) });
  const deleteRecipe = (recipe: Recipe) => { onSave({ ...profile, recipes: recipes.filter((item) => item.id !== recipe.id), mealPlanEntries: entries.filter((entry) => entry.recipeId !== recipe.id) }); setDeletingRecipe(undefined); };
  const addPlanEntry = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!recipeId) return;
    onSave({ ...profile, mealPlanEntries: [...(profile.mealPlanEntries || []), { id: `plan-${crypto.randomUUID()}`, recipeId, date, mealType }] });
  };
  const removeEntry = (id: string) => onSave({ ...profile, mealPlanEntries: (profile.mealPlanEntries || []).filter((entry) => entry.id !== id) });
  const plannedRecipes = entries.map((entry) => recipes.find((recipe) => recipe.id === entry.recipeId)).filter((recipe): recipe is Recipe => Boolean(recipe));
  const groceries = groceryItemsForPlan(plannedRecipes);
  return <main className="page plan-page">
    <header className="page-header"><span className="eyebrow">Make tomorrow easier</span><h1>Recipes & plan</h1><p>Keep your recipes private, place them on a day, and turn the ingredients into a calm shopping list.</p></header>
    <div className="workspace-tabs" role="tablist" aria-label="Plan workspace"><button id="plan-week-tab" type="button" role="tab" aria-selected={section === "week"} aria-controls="plan-week-panel" className={section === "week" ? "active" : ""} onClick={() => setSection("week")}>This week</button><button id="plan-recipes-tab" type="button" role="tab" aria-selected={section === "recipes"} aria-controls="plan-recipes-panel" className={section === "recipes" ? "active" : ""} onClick={() => setSection("recipes")}>Recipes <span>{recipes.length}</span></button><button id="plan-shopping-tab" type="button" role="tab" aria-selected={section === "shopping"} aria-controls="plan-shopping-panel" className={section === "shopping" ? "active" : ""} onClick={() => setSection("shopping")}>Shopping <span>{groceries.length}</span></button></div>
    {section === "week" && <section id="plan-week-panel" role="tabpanel" aria-labelledby="plan-week-tab" className="planning-workspace workspace-panel">{recipes.length > 0 ? <><div className="section-heading"><div><span className="eyebrow">Lightweight planning</span><h2>Add a meal to your plan</h2></div></div><form className="plan-entry-form card" onSubmit={addPlanEntry}><label><span>Recipe</span><ThemedSelect ariaLabel="Recipe to plan" value={recipeId} onChange={setRecipeId} options={[{ value: "", label: "Choose a recipe" }, ...recipes.map((recipe) => ({ value: recipe.id, label: recipe.name }))]} /></label><div className="form-grid two"><label><span>Date</span><input required type="date" min={localDateKey()} value={date} onChange={(event) => setDate(event.target.value)} /></label><label><span>Meal</span><ThemedSelect ariaLabel="Planned meal" value={mealType} onChange={(value) => setMealType(value as MealType)} options={(Object.keys(mealLabels) as MealType[]).map((type) => ({ value: type, label: mealLabels[type] }))} /></label></div><button className="primary-button" type="submit" disabled={!recipeId}><CalendarPlus size={17} />Add to plan</button></form>{entries.length > 0 && <div className="planned-list">{entries.map((entry) => { const recipe = recipes.find((item) => item.id === entry.recipeId); return recipe ? <div className="planned-entry card" key={entry.id}><span><strong>{recipe.name}</strong><small>{new Date(`${entry.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {mealLabels[entry.mealType]}</small></span><button className="icon-button subtle-button" type="button" aria-label={`Remove ${recipe.name} from plan`} onClick={() => removeEntry(entry.id)}><X size={16} /></button></div> : null; })}</div>}</> : <div className="recipe-empty card"><span className="action-icon mint"><BookOpen size={22} /></span><strong>Start with a recipe.</strong><p>Save one of your regular meals, then add it to a day here.</p><button type="button" className="secondary-button" onClick={() => setSection("recipes")}><BookOpen size={16} />Open recipes</button></div>}</section>}
    {section === "recipes" && <section id="plan-recipes-panel" role="tabpanel" aria-labelledby="plan-recipes-tab" className="workspace-panel"><details className="recipe-create card" open={recipeComposerOpen} onToggle={(event) => setRecipeComposerOpen(event.currentTarget.open)}><summary><span><BookOpen size={18} /><strong>Save a recipe</strong><small>Store the portions and nutrition you use.</small></span><ChevronDown size={17} /></summary><RecipeComposer onSave={(recipe) => { addRecipe(recipe); setRecipeComposerOpen(false); }} /></details><section className="recipe-library" aria-labelledby="recipe-library-heading"><div className="section-heading"><div><span className="eyebrow">Your library</span><h2 id="recipe-library-heading">Saved recipes</h2></div><span className="subtle">{recipes.length} saved</span></div>{recipes.length ? <div className="recipe-list">{recipes.map((recipe) => <article className="recipe-card card" key={recipe.id}><div><strong>{recipe.name}</strong><small>{recipe.servings} servings · {Math.round(recipe.nutritionPerServing.protein)}g protein</small></div><div className="recipe-card-actions"><button className="text-button" type="button" onClick={() => setLoggingRecipe(recipe)}><BookOpen size={15} />Log recipe</button><button className="icon-button subtle-button" type="button" aria-label={`Edit ${recipe.name}`} onClick={() => setEditingRecipe(recipe)}><Pencil size={15} /></button><button className="icon-button subtle-button danger" type="button" aria-label={`Delete ${recipe.name}`} onClick={() => setDeletingRecipe(recipe)}><Trash2 size={15} /></button></div></article>)}</div> : <div className="recipe-empty card"><span className="action-icon mint"><BookOpen size={22} /></span><strong>Your regular meals belong here.</strong><p>Save one recipe and it can be logged or planned without rebuilding it.</p><button type="button" className="secondary-button" onClick={() => setRecipeComposerOpen(true)}><Plus size={16} />Save your first recipe</button></div>}</section></section>}
    {section === "shopping" && <section id="plan-shopping-panel" role="tabpanel" aria-labelledby="plan-shopping-tab" className="planned-groceries card workspace-panel"><div className="section-heading compact"><div><span className="eyebrow">From your plan</span><h2>Shopping list</h2></div><ListChecks size={18} /></div>{groceries.length ? <ul>{groceries.map((item) => <li key={item}>{item}</li>)}</ul> : <p>{recipes.length ? "Plan a recipe for a day and its ingredients will appear here." : "Plan a saved recipe and its ingredients will appear here. Your existing Coach grocery lists remain available in Coach."}</p>}</section>}
    {loggingRecipe && <Sheet onClose={() => setLoggingRecipe(undefined)} label={`Log ${loggingRecipe.name}`} wide><RecipeLogSheet recipe={loggingRecipe} foods={foods} meals={meals} onSaveFood={onSaveFood} onLog={onLog} onClose={() => setLoggingRecipe(undefined)} /></Sheet>}
    {editingRecipe && <Sheet onClose={() => setEditingRecipe(undefined)} label={`Edit ${editingRecipe.name}`} wide><div className="recipe-edit-sheet"><div className="sheet-header"><div><span className="eyebrow">Saved recipe</span><h2>Edit recipe</h2></div><span /></div><RecipeComposer recipe={editingRecipe} onSave={(recipe) => { saveRecipe(recipe); setEditingRecipe(undefined); }} /></div></Sheet>}
    {deletingRecipe && <Sheet onClose={() => setDeletingRecipe(undefined)} label={`Delete ${deletingRecipe.name}`}><div className="recipe-delete-sheet"><div className="sheet-header"><div><span className="eyebrow">Saved recipe</span><h2>Delete recipe?</h2></div><span /></div><p><strong>{deletingRecipe.name}</strong> will be removed from your recipe library and any future meal plans. Meals you already logged will stay in your diary.</p><div className="sheet-actions"><button type="button" className="secondary-button" onClick={() => setDeletingRecipe(undefined)}>Cancel</button><button type="button" className="primary-button danger-button" onClick={() => deleteRecipe(deletingRecipe)}><Trash2 size={17} />Delete recipe</button></div></div></Sheet>}
  </main>;
}


/**
 * Stateful client coordinator. Feature views receive explicit data and actions
 * from here; this is the only place where local persistence and optional cloud
 * synchronization are composed with the product UI.
 */
