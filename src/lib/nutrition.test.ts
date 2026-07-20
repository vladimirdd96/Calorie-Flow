import { describe, expect, it } from "vitest";
import { calculateCalories, calculateMacroTargets, gramsFor, scaleNutrition, suggestedMealType } from "./nutrition";
import type { Food } from "./types";

const food: Food = {
  id: "test",
  name: "Test food",
  servingGrams: 60,
  packageGrams: 180,
  nutrientsPer100: { calories: 200, protein: 10, carbs: 20, fat: 8, fiber: 4, sugar: 2 },
  source: "custom",
};

describe("nutrition calculations", () => {
  it("scales per-100g nutrition", () => {
    expect(scaleNutrition(food.nutrientsPer100, 60)).toEqual({
      calories: 120,
      protein: 6,
      carbs: 12,
      fat: 4.8,
      fiber: 2.4,
      sugar: 1.2,
    });
  });

  it("converts contextual portions to grams", () => {
    expect(gramsFor(food, 2, "serving")).toBe(120);
    expect(gramsFor(food, 1, "package")).toBe(180);
    expect(gramsFor(food, 1, "tbsp")).toBe(15);
  });

  it("calculates the user's maintenance target", () => {
    expect(calculateCalories({ sex: "male", age: 29, heightCm: 191, weightKg: 84, activity: "moderate", goalMode: "maintain" })).toBe(2925);
  });

  it("keeps keto carbs low", () => {
    expect(calculateMacroTargets(2900, 84, "high-protein-keto").carbs).toBe(30);
  });

  it("suggests the meal type from the user's local hour", () => {
    expect(suggestedMealType(new Date(2026, 6, 20, 10, 59))).toBe("breakfast");
    expect(suggestedMealType(new Date(2026, 6, 20, 11, 0))).toBe("lunch");
    expect(suggestedMealType(new Date(2026, 6, 20, 14, 59))).toBe("lunch");
    expect(suggestedMealType(new Date(2026, 6, 20, 15, 0))).toBe("dinner");
  });
});
