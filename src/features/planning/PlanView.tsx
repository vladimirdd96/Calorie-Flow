"use client";

import { BookOpen, CalendarDays, CalendarRange, ChevronDown, ChevronLeft, ChevronRight, Library, ListChecks, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { Sheet } from "@/features/shared/Sheet";
import { PortionSheet } from "@/features/food-capture/FoodCapture";
import { PlanCalendarSheet } from "./components/PlanCalendarSheet";
import { QuickPlanSheet } from "./components/QuickPlanSheet";
import { WeekStrip } from "./components/WeekStrip";
import { PlanSlotCard } from "./components/PlanSlotCard";
import { RecipeComposer } from "./components/RecipeComposer";
import { RecipeCard } from "./components/RecipeCard";
import { CatalogueView } from "./components/CatalogueView";
import { ShoppingList } from "./components/ShoppingList";
import { localDateKey } from "@/lib/nutrition";
import { groceryItemsForPlan } from "@/lib/planning";
import { publishRecipeToCatalogue, unpublishRecipe } from "@/lib/cloud";
import { recipeAsFood } from "@/features/recipes/recipeLogging";
import type { Food, Meal, MealType, Profile, PublicRecipe, Recipe } from "@/lib/types";

const mealLabels: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

function upsertRecipe(recipes: Recipe[], recipe: Recipe): Recipe[] {
  return recipes.some((item) => item.id === recipe.id) ? recipes.map((item) => item.id === recipe.id ? recipe : item) : [...recipes, recipe];
}

function cloneFromCatalogue(item: PublicRecipe, recipes: Recipe[]): Recipe {
  const existing = recipes.find((recipe) => recipe.publicRecipeId === item.id);
  if (existing) return existing;
  const now = new Date().toISOString();
  return {
    id: `recipe-${crypto.randomUUID()}`,
    name: item.name,
    servings: item.servings,
    servingGrams: item.servingGrams,
    ingredients: item.ingredients.map((ingredient) => ({ ...ingredient, id: `ingredient-${crypto.randomUUID()}` })),
    nutritionPerServing: item.nutritionPerServing,
    imageUrls: item.imageUrl ? [item.imageUrl] : undefined,
    publicRecipeId: item.id,
    createdAt: now,
    updatedAt: now,
  };
}

export function PlanView({ profile, foods, meals, userId, onSave, onLog, onOpenFoods, onOpenAdd }: {
  profile: Profile;
  foods: Food[];
  meals: Meal[];
  userId?: string;
  onSave: (profile: Profile) => void;
  onLog: (meal: Meal) => Promise<void>;
  onOpenFoods: () => void;
  onOpenAdd: (date: string, mealType: MealType) => void;
}) {
  const recipes = profile.recipes || [];
  const entries = (profile.mealPlanEntries || []).filter((entry) => entry.recipeId ? recipes.some((recipe) => recipe.id === entry.recipeId) : foods.some((food) => food.id === entry.foodId)).sort((a, b) => a.date.localeCompare(b.date));
  const [recipeComposerOpen, setRecipeComposerOpen] = useState(false);
  const [date, setDate] = useState(localDateKey());
  const [section, setSection] = useState<"week" | "recipes" | "catalogue" | "shopping">("week");
  const [loggingRecipe, setLoggingRecipe] = useState<Recipe>();
  const [editingRecipe, setEditingRecipe] = useState<Recipe>();
  const [deletingRecipe, setDeletingRecipe] = useState<Recipe>();
  const [planCalendarOpen, setPlanCalendarOpen] = useState(false);
  const [quickPlanRecipe, setQuickPlanRecipe] = useState<Recipe>();
  const [sharingRecipeId, setSharingRecipeId] = useState<string>();

  const saveRecipe = (recipe: Recipe) => onSave({ ...profile, recipes: upsertRecipe(recipes, recipe) });
  const addRecipe = (recipe: Recipe) => onSave({ ...profile, recipes: [...recipes, recipe] });
  const deleteRecipe = (recipe: Recipe) => { onSave({ ...profile, recipes: recipes.filter((item) => item.id !== recipe.id), mealPlanEntries: entries.filter((entry) => entry.recipeId !== recipe.id) }); setDeletingRecipe(undefined); };
  const removeEntry = (id: string) => onSave({ ...profile, mealPlanEntries: (profile.mealPlanEntries || []).filter((entry) => entry.id !== id) });
  const planRecipeEntry = (recipe: Recipe, entryDate: string, mealType: MealType) => onSave({ ...profile, recipes: upsertRecipe(recipes, recipe), mealPlanEntries: [...(profile.mealPlanEntries || []), { id: `plan-${crypto.randomUUID()}`, recipeId: recipe.id, date: entryDate, mealType }] });
  const saveToLibrary = (item: PublicRecipe): Recipe => {
    const recipe = cloneFromCatalogue(item, recipes);
    if (!recipes.some((existing) => existing.id === recipe.id)) onSave({ ...profile, recipes: [...recipes, recipe] });
    return recipe;
  };
  const toggleShare = async (recipe: Recipe) => {
    if (!userId) return;
    setSharingRecipeId(recipe.id);
    try {
      if (recipe.isPublic && recipe.publicRecipeId) {
        await unpublishRecipe(userId, recipe.publicRecipeId);
        saveRecipe({ ...recipe, isPublic: false, publicRecipeId: undefined });
      } else {
        const publicRecipeId = await publishRecipeToCatalogue(userId, recipe);
        saveRecipe({ ...recipe, isPublic: true, publicRecipeId });
      }
    } catch { /* best-effort — the recipe keeps its previous share state locally */ }
    finally { setSharingRecipeId(undefined); }
  };

  const plannedRecipes = entries.map((entry) => entry.recipeId ? recipes.find((recipe) => recipe.id === entry.recipeId) : undefined).filter((recipe): recipe is Recipe => Boolean(recipe));
  const groceries = groceryItemsForPlan(plannedRecipes);
  const movePlanDay = (offset: number) => {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + offset);
    setDate(localDateKey(next));
  };
  const planDayLabel = date === localDateKey() ? "Today" : new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const dayEntries = entries.filter((entry) => entry.date === date);

  return <main className="page plan-page">
    <header className="plan-handoff-header"><span>Plan</span><div><h1>{section === "shopping" ? "Shopping list" : section === "recipes" ? "Your recipes" : section === "catalogue" ? "Recipe catalogue" : "Plan your week"}</h1><button type="button" onClick={onOpenFoods}><Library size={16} />Foods</button></div></header>
    <div className="workspace-tabs" role="tablist" aria-label="Plan workspace">
      <button id="plan-week-tab" type="button" role="tab" aria-selected={section === "week"} aria-controls="plan-week-panel" className={section === "week" ? "active" : ""} onClick={() => setSection("week")}><CalendarRange size={15} />This week</button>
      <button id="plan-recipes-tab" type="button" role="tab" aria-selected={section === "recipes"} aria-controls="plan-recipes-panel" className={section === "recipes" ? "active" : ""} onClick={() => setSection("recipes")}><BookOpen size={15} />Recipes</button>
      <button id="plan-catalogue-tab" type="button" role="tab" aria-selected={section === "catalogue"} aria-controls="plan-catalogue-panel" className={section === "catalogue" ? "active" : ""} onClick={() => setSection("catalogue")}><Sparkles size={15} />Catalogue</button>
      <button id="plan-shopping-tab" type="button" role="tab" aria-selected={section === "shopping"} aria-controls="plan-shopping-panel" className={section === "shopping" ? "active" : ""} onClick={() => setSection("shopping")}><ListChecks size={15} />Shopping{groceries.length > 0 && <span>{groceries.length}</span>}</button>
    </div>

    {section === "week" && <section id="plan-week-panel" role="tabpanel" aria-labelledby="plan-week-tab" className="planning-workspace workspace-panel">
      <WeekStrip date={date} entries={entries} recipes={recipes} foods={foods} onSelect={setDate} />
      <div className="plan-day-switcher"><button type="button" aria-label="Previous day" onClick={() => movePlanDay(-1)}><ChevronLeft size={16} /></button><button type="button" className="plan-day-label" onClick={() => setPlanCalendarOpen(true)}><CalendarDays size={15} />{planDayLabel}</button><button type="button" aria-label="Next day" onClick={() => movePlanDay(1)}><ChevronRight size={16} /></button></div>
      <div className="plan-slot-list">{(Object.keys(mealLabels) as MealType[]).map((type) => {
        const entry = dayEntries.find((item) => item.mealType === type);
        const recipe = entry?.recipeId ? recipes.find((item) => item.id === entry.recipeId) : undefined;
        const food = entry?.foodId ? foods.find((item) => item.id === entry.foodId) : undefined;
        return <PlanSlotCard key={type} mealLabel={mealLabels[type]} entry={entry} recipe={recipe} food={food} onRemove={() => entry && removeEntry(entry.id)} onAdd={() => onOpenAdd(date, type)} />;
      })}</div>
    </section>}

    {section === "recipes" && <section id="plan-recipes-panel" role="tabpanel" aria-labelledby="plan-recipes-tab" className="workspace-panel">
      <details className="recipe-create card" open={recipeComposerOpen} onToggle={(event) => setRecipeComposerOpen(event.currentTarget.open)}>
        <summary><span><BookOpen size={18} /><strong>Save a recipe</strong><small>Store the portions and nutrition you use.</small></span><ChevronDown size={17} /></summary>
        <RecipeComposer userId={userId} onSave={(recipe) => { addRecipe(recipe); setRecipeComposerOpen(false); }} />
      </details>
      <section className="recipe-library" aria-labelledby="recipe-library-heading">
        <div className="section-heading"><div><span className="eyebrow">Your library</span><h2 id="recipe-library-heading">Saved recipes</h2></div><span className="subtle">{recipes.length} saved</span></div>
        {recipes.length ? <div className="recipe-list">{recipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} sharing={sharingRecipeId === recipe.id} onLog={() => setLoggingRecipe(recipe)} onPlan={() => setQuickPlanRecipe(recipe)} onEdit={() => setEditingRecipe(recipe)} onDelete={() => setDeletingRecipe(recipe)} onToggleShare={userId ? () => void toggleShare(recipe) : undefined} />)}</div>
          : <div className="recipe-empty card"><span className="action-icon mint"><BookOpen size={22} /></span><strong>Your regular meals belong here.</strong><p>Save one recipe and it can be logged or planned without rebuilding it.</p><button type="button" className="secondary-button" onClick={() => setRecipeComposerOpen(true)}><Plus size={16} />Save your first recipe</button></div>}
      </section>
    </section>}

    {section === "catalogue" && <CatalogueView userId={userId} meals={meals} recipes={recipes} entries={entries} hideCalories={profile.hideCalories} onSaveToLibrary={saveToLibrary} onPlanRecipe={planRecipeEntry} />}

    {section === "shopping" && <ShoppingList items={groceries} hasRecipes={recipes.length > 0} />}

    {planCalendarOpen && <Sheet label="Choose a plan date" onClose={() => setPlanCalendarOpen(false)}><PlanCalendarSheet dateKey={date} entries={entries} onSelect={(nextDate) => { setDate(nextDate); setPlanCalendarOpen(false); }} /></Sheet>}
    {loggingRecipe && <Sheet onClose={() => setLoggingRecipe(undefined)} wide showClose={false} className="add-food-sheet-shell"><PortionSheet food={recipeAsFood(loggingRecipe, foods)} recipeId={loggingRecipe.id} hideCalories={profile.hideCalories} onLog={(meal) => void onLog(meal)} onClose={() => setLoggingRecipe(undefined)} /></Sheet>}
    {editingRecipe && <Sheet onClose={() => setEditingRecipe(undefined)} label={`Edit ${editingRecipe.name}`} wide><div className="recipe-edit-sheet"><div className="sheet-header"><div><span className="eyebrow">Saved recipe</span><h2>Edit recipe</h2></div><span /></div><RecipeComposer recipe={editingRecipe} userId={userId} onSave={(recipe) => { saveRecipe(recipe); setEditingRecipe(undefined); }} /></div></Sheet>}
    {deletingRecipe && <Sheet onClose={() => setDeletingRecipe(undefined)} label={`Delete ${deletingRecipe.name}`}><div className="recipe-delete-sheet"><div className="sheet-header"><div><span className="eyebrow">Saved recipe</span><h2>Delete recipe?</h2></div><span /></div><p><strong>{deletingRecipe.name}</strong> will be removed from your recipe library and any future meal plans. Meals you already logged will stay in your diary.</p><div className="sheet-actions"><button type="button" className="secondary-button" onClick={() => setDeletingRecipe(undefined)}>Cancel</button><button type="button" className="primary-button danger-button" onClick={() => deleteRecipe(deletingRecipe)}><Trash2 size={17} />Delete recipe</button></div></div></Sheet>}
    {quickPlanRecipe && <Sheet onClose={() => setQuickPlanRecipe(undefined)} label={`Plan ${quickPlanRecipe.name}`}><QuickPlanSheet entries={entries} initialDate={date} itemName={quickPlanRecipe.name} onConfirm={(entryDate, mealType) => { planRecipeEntry(quickPlanRecipe, entryDate, mealType); setQuickPlanRecipe(undefined); }} /></Sheet>}
  </main>;
}


/**
 * Stateful client coordinator. Feature views receive explicit data and actions
 * from here; this is the only place where local persistence and optional cloud
 * synchronization are composed with the product UI.
 */
