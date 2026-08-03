import { describe, expect, it } from "vitest";
import { groceryItemsForPlan, recipeMeal, recipeSearchKey, topEatenFoods } from "./planning";
import type { Meal, Recipe } from "./types";

const recipe: Recipe = { id: "recipe-1", name: "Lentil bowl", servings: 2, ingredients: [{ id: "a", name: "Lentils" }, { id: "b", name: "Spinach" }], nutritionPerServing: { calories: 420, protein: 25, carbs: 55, fat: 12, fiber: 16, sugar: 4 }, createdAt: "2026-07-20T12:00:00.000Z", updatedAt: "2026-07-20T12:00:00.000Z" };

describe("meal planning", () => {
  it("creates a diary meal from one recipe serving", () => {
    expect(recipeMeal(recipe, "2026-07-21", "dinner").nutrition.calories).toBe(420);
    expect(recipeMeal(recipe, "2026-07-21", "dinner").loggedDate).toBe("2026-07-21");
  });

  it("deduplicates grocery ingredients from planned recipes and records which recipes use each", () => {
    const secondRecipe: Recipe = { ...recipe, id: "recipe-2", name: "Rice bowl", ingredients: [{ id: "c", name: "spinach" }, { id: "d", name: "Rice" }] };
    expect(groceryItemsForPlan([recipe, secondRecipe])).toEqual([
      { name: "Lentils", recipeNames: ["Lentil bowl"] },
      { name: "Spinach", recipeNames: ["Lentil bowl", "Rice bowl"] },
      { name: "Rice", recipeNames: ["Rice bowl"] },
    ]);
  });
});

describe("recipeSearchKey", () => {
  it("normalizes names so near-duplicates collide", () => {
    expect(recipeSearchKey("  Weeknight Lentil Bowl! ")).toBe(recipeSearchKey("weeknight lentil bowl"));
    expect(recipeSearchKey("Lentil Bowl")).not.toBe(recipeSearchKey("Rice Bowl"));
  });
});

describe("topEatenFoods", () => {
  const meal = (name: string, loggedDate: string): Meal => ({
    id: `meal-${name}-${loggedDate}`, name, mealType: "lunch", amount: 1, unit: "serving", grams: 100,
    nutrition: { calories: 100, protein: 5, carbs: 10, fat: 2, fiber: 1, sugar: 1 }, createdAt: `${loggedDate}T12:00:00.000Z`, loggedDate, source: "custom",
  });

  it("ranks the most-logged names within the window and excludes older entries", () => {
    const today = new Date().toISOString().slice(0, 10);
    const old = "2000-01-01";
    const meals = [meal("Beef", today), meal("Beef", today), meal("Spinach", today), meal("Beef", old)];
    expect(topEatenFoods(meals, 30)).toEqual(["Beef", "Spinach"]);
  });

  it("respects the limit", () => {
    const today = new Date().toISOString().slice(0, 10);
    const meals = ["A", "B", "C"].map((name) => meal(name, today));
    expect(topEatenFoods(meals, 30, 2)).toHaveLength(2);
  });
});
