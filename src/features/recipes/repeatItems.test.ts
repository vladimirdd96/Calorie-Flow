import { describe, expect, it } from "vitest";
import { repeatItems } from "./repeatItems";
import type { Food, Meal, Recipe } from "../../lib/types";

const food = (id: string): Food => ({ id, name: id, nutrientsPer100: { calories: 100, protein: 1, carbs: 1, fat: 1, fiber: 1, sugar: 1 }, source: "custom" });
const recipe = (id: string): Recipe => ({ id, name: id, servings: 1, ingredients: [], nutritionPerServing: { calories: 100, protein: 1, carbs: 1, fat: 1, fiber: 1, sugar: 1 }, createdAt: "2026-07-01T12:00:00.000Z", updatedAt: "2026-07-01T12:00:00.000Z" });
const meal = (id: string, createdAt: string, additions: Partial<Meal>): Meal => ({ id, name: "Meal", mealType: "breakfast", amount: 1, unit: "serving", grams: 100, nutrition: { calories: 100, protein: 1, carbs: 1, fat: 1, fiber: 1, sugar: 1 }, createdAt, source: "custom", ...additions });

describe("repeat items", () => {
  it("prioritizes the most-picked foods and counts each recipe log once", () => {
    const meals = [
      meal("one", "2026-07-03T09:00:00.000Z", { foodId: "banana" }),
      meal("two", "2026-07-02T09:00:00.000Z", { foodId: "banana" }),
      meal("three", "2026-07-04T09:00:00.000Z", { foodId: "oats" }),
      meal("four", "2026-07-05T09:00:00.000Z", { recipeId: "porridge", recipeLogId: "log-1" }),
      meal("five", "2026-07-05T09:00:01.000Z", { recipeId: "porridge", recipeLogId: "log-1" }),
    ];
    expect(repeatItems([food("banana"), food("oats")], [recipe("porridge")], meals).map(({ kind, item, uses }) => [kind, item.id, uses])).toEqual([
      ["food", "banana", 2],
      ["recipe", "porridge", 1],
      ["food", "oats", 1],
    ]);
  });
});
