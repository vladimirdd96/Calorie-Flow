import { describe, expect, it } from "vitest";
import { calculateCalories, calculateMacroTargets, gramsFor, netCarbs, resolveDailyTargets, resolveMealCalorieTarget, scaleNutrition, sumNutrition, suggestedMealType } from "./nutrition";
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

  it("scales and sums micronutrients with the meal portion", () => {
    const nutrition = { ...food.nutrientsPer100, micronutrients: { sodiumMg: 100, cholesterolMg: 20, saturatedFatG: 1, potassiumMg: 200, calciumMg: 50, ironMg: 2, magnesiumMg: 10, zincMg: 1, vitaminAMcg: 10, vitaminCMg: 20, vitaminDMcg: 1, vitaminEMg: 2, vitaminKMcg: 3, vitaminB12Mcg: 0.5, folateMcg: 8 } };
    const portion = scaleNutrition(nutrition, 60);
    expect(portion.micronutrients?.sodiumMg).toBe(60);
    expect(sumNutrition([portion, portion]).micronutrients?.calciumMg).toBe(60);
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

  it("calculates net carbs without allowing fibre to make carbs negative", () => {
    expect(netCarbs({ ...food.nutrientsPer100, carbs: 20, fiber: 4 })).toBe(16);
    expect(netCarbs({ ...food.nutrientsPer100, carbs: 2, fiber: 4 })).toBe(0);
  });

  it("resolves a weekday target override without changing the base profile", () => {
    const profile = {
      sex: "male" as const, age: 29, heightCm: 191, weightKg: 84, activity: "moderate" as const, goalMode: "maintain" as const,
      name: "", dietPreset: "balanced" as const, calorieTarget: 2500, proteinTarget: 160, carbsTarget: 280, fatTarget: 75, fiberTarget: 30,
      hideCalories: false, onboardingDone: true,
      dailyTargets: { monday: { calories: 2300, protein: 170, carbs: 210, fat: 80, fiber: 35 } },
    };
    expect(resolveDailyTargets(profile, "2026-07-20")).toEqual({ calories: 2300, protein: 170, carbs: 210, fat: 80, fiber: 35 });
    expect(resolveDailyTargets(profile, "2026-07-21")).toEqual({ calories: 2500, protein: 160, carbs: 280, fat: 75, fiber: 30 });
  });

  it("uses an optional target for an individual meal without inventing one", () => {
    expect(resolveMealCalorieTarget({ mealCalorieTargets: { lunch: 720 } }, "lunch")).toBe(720);
    expect(resolveMealCalorieTarget({ mealCalorieTargets: { lunch: 720 } }, "dinner")).toBeUndefined();
  });

});
