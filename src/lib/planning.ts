import type { Meal, MealType, Recipe } from "./types";

export function recipeMeal(recipe: Recipe, loggedDate: string, mealType: MealType): Meal {
  return {
    id: `recipe-${crypto.randomUUID()}`,
    name: recipe.name,
    mealType,
    amount: 1,
    unit: "serving",
    grams: 100,
    nutrition: recipe.nutritionPerServing,
    createdAt: new Date(`${loggedDate}T12:00:00`).toISOString(),
    loggedDate,
    source: "custom",
  };
}

export type GroceryItem = { name: string; recipeNames: string[] };

/** Dedupes ingredient names across planned recipes plus any manually added items, case-insensitively, and records which recipe(s) each came from. Manually added items carry no recipe name. */
export function groceryItemsForPlan(recipes: Recipe[], extraNames: string[] = []): GroceryItem[] {
  const byKey = new Map<string, GroceryItem>();
  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) {
      const name = ingredient.name.trim();
      if (!name) continue;
      const key = name.toLocaleLowerCase();
      const existing = byKey.get(key);
      if (existing) {
        if (!existing.recipeNames.includes(recipe.name)) existing.recipeNames.push(recipe.name);
      } else {
        byKey.set(key, { name, recipeNames: [recipe.name] });
      }
    }
  }
  for (const raw of extraNames) {
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    if (!byKey.has(key)) byKey.set(key, { name, recipeNames: [] });
  }
  return [...byKey.values()];
}

/** Normalizes a recipe name into a comparable key for catalogue dedupe (client publish + server generate). */
export function recipeSearchKey(name: string): string {
  return name.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

const quantityFractions: Record<string, number> = { "¼": 0.25, "½": 0.5, "¾": 0.75, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875 };
const fractionLabels: [number, string][] = [[0.875, "⅞"], [0.75, "¾"], [0.625, "⅝"], [0.5, "½"], [0.375, "⅜"], [0.25, "¼"], [0.125, "⅛"]];

/** Scales a leading numeric/fraction quantity ("1¼ lb", "3 cloves") by a factor, keeping the trailing unit text as-is. */
export function scaleIngredientQuantity(quantity: string, factor: number): string {
  const match = quantity.match(/^(\d*)\s*([¼½¾⅛⅜⅝⅞])?/);
  if (!match || (!match[1] && !match[2])) return quantity;
  const whole = match[1] ? Number(match[1]) : 0;
  const frac = match[2] ? quantityFractions[match[2]] : 0;
  const rest = quantity.slice(match[0].length);
  const amount = Math.max(0.125, Math.round((whole + frac) * factor * 8) / 8);
  const roundedWhole = Math.floor(amount);
  const roundedFrac = Math.round((amount - roundedWhole) * 1000) / 1000;
  const fracEntry = fractionLabels.find(([value]) => Math.abs(value - roundedFrac) < 0.01);
  const fracLabel = fracEntry ? fracEntry[1] : "";
  const numberLabel = roundedWhole > 0 ? `${roundedWhole}${fracLabel}` : fracLabel || "0";
  return `${numberLabel}${rest}`;
}

/** Turns a camelCase taxonomy key ("glutenFree") into a display label ("Gluten-Free"). */
export function humanizeTaxonomyKey(key: string): string {
  const spaced = key.replace(/([A-Z])/g, " $1").trim();
  const label = spaced.charAt(0).toUpperCase() + spaced.slice(1);
  return label.replace(/^Gluten Free$/, "Gluten-Free").replace(/^Dairy Free$/, "Dairy-Free");
}

/** Ranks the user's most-logged food/meal names over the trailing window, for catalogue personalization. */
export function topEatenFoods(meals: Meal[], days = 30, limit = 8): string[] {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const counts = new Map<string, { name: string; count: number }>();
  for (const meal of meals) {
    const loggedAt = meal.loggedDate ? new Date(`${meal.loggedDate}T12:00:00`).getTime() : new Date(meal.createdAt).getTime();
    if (!Number.isFinite(loggedAt) || loggedAt < since) continue;
    const name = meal.name.trim();
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { name, count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit).map((entry) => entry.name);
}
