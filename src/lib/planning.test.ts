import { describe, expect, it } from "vitest";
import { groceryItemsForPlan, recipeMeal } from "./planning";
import type { Recipe } from "./types";

const recipe: Recipe = { id: "recipe-1", name: "Lentil bowl", servings: 2, ingredients: [{ id: "a", name: "Lentils" }, { id: "b", name: "Spinach" }], nutritionPerServing: { calories: 420, protein: 25, carbs: 55, fat: 12, fiber: 16, sugar: 4 }, createdAt: "2026-07-20T12:00:00.000Z", updatedAt: "2026-07-20T12:00:00.000Z" };

describe("meal planning", () => {
  it("creates a diary meal from one recipe serving", () => {
    expect(recipeMeal(recipe, "2026-07-21", "dinner").nutrition.calories).toBe(420);
    expect(recipeMeal(recipe, "2026-07-21", "dinner").loggedDate).toBe("2026-07-21");
  });

  it("deduplicates grocery ingredients from planned recipes", () => {
    expect(groceryItemsForPlan([recipe, { ...recipe, id: "recipe-2", ingredients: [{ id: "c", name: "spinach" }, { id: "d", name: "Rice" }] }])).toEqual(["Lentils", "Spinach", "Rice"]);
  });
});
