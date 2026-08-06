import { describe, expect, it } from "vitest";
import { findDuplicateRecipe, groceryItemsForPlan, importSourceKey, recipeMeal, recipeSearchKey, scaleIngredientQuantity, topEatenFoods } from "./planning";
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

describe("importSourceKey", () => {
  it("treats the same page as equal despite scheme, www, tracking, fragment, and trailing slash", () => {
    const canonical = importSourceKey("https://budgetbytes.com/black-bean-burgers");
    for (const variant of [
      "https://www.budgetbytes.com/black-bean-burgers/",
      "https://www.BudgetBytes.com/Black-Bean-Burgers",
      "https://budgetbytes.com/black-bean-burgers?utm_source=pinterest",
      "https://budgetbytes.com/black-bean-burgers#recipe",
    ]) {
      expect(importSourceKey(variant), variant).toBe(canonical);
    }
  });

  it("keeps different pages on the same site apart", () => {
    expect(importSourceKey("https://budgetbytes.com/black-bean-burgers")).not.toBe(importSourceKey("https://budgetbytes.com/lentil-soup"));
  });

  it("returns undefined for an unparseable url", () => {
    expect(importSourceKey("not a url")).toBeUndefined();
  });
});

describe("findDuplicateRecipe", () => {
  const imported: Recipe = { ...recipe, id: "recipe-imported", name: "Black bean burgers", origin: "imported", importedFrom: { url: "https://www.budgetbytes.com/black-bean-burgers/", siteName: "budgetbytes.com" } };

  it("matches the same source page even when the recipe was renamed", () => {
    const candidate = { name: "Something else entirely", importedFrom: { url: "https://budgetbytes.com/black-bean-burgers?utm_source=x" } };
    expect(findDuplicateRecipe([recipe, imported], candidate)?.id).toBe("recipe-imported");
  });

  it("falls back to the normalized name when the source differs", () => {
    const candidate = { name: "  Black Bean Burgers! ", importedFrom: { url: "https://other.example/burgers" } };
    expect(findDuplicateRecipe([recipe, imported], candidate)?.id).toBe("recipe-imported");
  });

  it("matches a hand-created recipe by name, not only imported ones", () => {
    expect(findDuplicateRecipe([recipe], { name: "lentil bowl" })?.id).toBe("recipe-1");
  });

  it("returns undefined when nothing matches", () => {
    expect(findDuplicateRecipe([recipe, imported], { name: "Roast pumpkin soup" })).toBeUndefined();
    expect(findDuplicateRecipe([], { name: "Anything" })).toBeUndefined();
  });
});

describe("scaleIngredientQuantity", () => {
  it("scales whole numbers and fractions, keeping the unit text", () => {
    expect(scaleIngredientQuantity("2 cups", 2)).toBe("4 cups");
    expect(scaleIngredientQuantity("½ tsp salt", 3)).toBe("1½ tsp salt");
    expect(scaleIngredientQuantity("1⅓ cup", 3)).toBe("4 cup");
    expect(scaleIngredientQuantity("3 cloves", 0.5)).toBe("1½ cloves");
  });

  it("leaves a quantity with no leading amount untouched", () => {
    expect(scaleIngredientQuantity("to taste", 2)).toBe("to taste");
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
