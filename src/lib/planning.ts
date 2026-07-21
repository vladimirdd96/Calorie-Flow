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

export function groceryItemsForPlan(recipes: Recipe[]) {
  const seen = new Set<string>();
  return recipes.flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.name.trim())).filter((name) => {
    const key = name.toLocaleLowerCase();
    if (!name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
