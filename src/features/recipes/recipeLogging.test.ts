import { describe, expect, it } from "vitest";
import { recipeIngredientNutrition, recipeNutritionForLogging } from "./recipeLogging";
import type { Food, Recipe } from "../../lib/types";

const foods: Food[] = [{
  id: "eggs",
  name: "Eggs",
  nutrientsPer100: { calories: 150, protein: 13, carbs: 1, fat: 11, fiber: 0, sugar: 1 },
  source: "custom",
}, {
  id: "tofu",
  name: "Tofu",
  nutrientsPer100: { calories: 80, protein: 9, carbs: 2, fat: 5, fiber: 1, sugar: 1 },
  source: "custom",
}];

const recipe: Recipe = {
  id: "breakfast",
  name: "Eggs on toast",
  servings: 1,
  ingredients: [
    { id: "egg", name: "Eggs", foodId: "eggs", grams: 120, nutrition: { calories: 999, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 } },
    { id: "toast", name: "Toast", grams: 40, nutrition: { calories: 100, protein: 4, carbs: 18, fat: 1, fiber: 3, sugar: 2 } },
  ],
  nutritionPerServing: { calories: 280, protein: 20, carbs: 20, fat: 14, fiber: 3, sugar: 3 },
  createdAt: "2026-07-22T08:00:00.000Z",
  updatedAt: "2026-07-22T08:00:00.000Z",
};

describe("recipe logging nutrition", () => {
  it("keeps the nutrition captured when the recipe was saved", () => {
    expect(recipeIngredientNutrition(recipe.ingredients[0], foods)).toMatchObject({ calories: 999 });
    expect(recipeNutritionForLogging(recipe, foods, {})).toMatchObject({ calories: 1099, protein: 4, carbs: 18, fat: 1, fiber: 3, sugar: 2 });
  });

  it("recalculates only an ingredient the user explicitly replaces", () => {
    expect(recipeIngredientNutrition(recipe.ingredients[0], foods, "eggs")).toMatchObject({ calories: 999 });
    expect(recipeIngredientNutrition(recipe.ingredients[0], foods, "tofu")).toMatchObject({ calories: 96, protein: 10.8, fat: 6 });
  });
});
