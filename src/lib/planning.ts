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

/** Dedupes ingredient names across planned recipes, case-insensitively, and records which recipe(s) each came from. */
export function groceryItemsForPlan(recipes: Recipe[]): GroceryItem[] {
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
  return [...byKey.values()];
}

/** Normalizes a recipe name into a comparable key for catalogue dedupe (client publish + server generate). */
export function recipeSearchKey(name: string): string {
  return name.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
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
