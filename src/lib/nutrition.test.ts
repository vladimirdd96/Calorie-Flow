import { describe, expect, it } from "vitest";
import { calculateCalories, calculateMacroTargets, gramsFor, netCarbs, resolveDailyTargets, resolveMealCalorieTarget, scaleNutrition, startOfWeek, sumNutrition, suggestedMealType } from "./nutrition";
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

  it("preserves two-decimal portion precision through gram and nutrition calculations", () => {
    expect(gramsFor(food, 0.25, "tbsp", { tbspGrams: 15.15 })).toBe(3.79);
    expect(scaleNutrition(food.nutrientsPer100, 12.34)).toMatchObject({ calories: 24.68, protein: 1.23, carbs: 2.47 });
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

  it("adjusts the calorie deficit and surplus by pace", () => {
    const base = { sex: "male" as const, age: 29, heightCm: 191, weightKg: 84, activity: "moderate" as const };
    expect(calculateCalories({ ...base, goalMode: "lose" })).toBe(calculateCalories({ ...base, goalMode: "lose", goalPace: "moderate" }));
    expect(calculateCalories({ ...base, goalMode: "lose", goalPace: "conservative" })).toBeGreaterThan(calculateCalories({ ...base, goalMode: "lose", goalPace: "moderate" }));
    expect(calculateCalories({ ...base, goalMode: "lose", goalPace: "aggressive" })).toBeLessThan(calculateCalories({ ...base, goalMode: "lose", goalPace: "moderate" }));
  });

  it("rounds the calorie target to a custom step", () => {
    const base = { sex: "male" as const, age: 29, heightCm: 191, weightKg: 84, activity: "moderate" as const, goalMode: "maintain" as const };
    expect(calculateCalories(base, 10) % 10).toBe(0);
    expect(calculateCalories(base, 50) % 50).toBe(0);
  });

  it("merges a macro preset override onto the base rule", () => {
    const defaultResult = calculateMacroTargets(2900, 84, "balanced");
    const overridden = calculateMacroTargets(2900, 84, "balanced", { balanced: { proteinPerKg: 2.5 } });
    expect(overridden.protein).toBeGreaterThan(defaultResult.protein);
  });

  it("resolves the start of the week for Monday and Sunday anchors", () => {
    expect(startOfWeek("2026-07-22").getDay()).toBe(1);
    expect(startOfWeek("2026-07-22", "sunday").getDay()).toBe(0);
  });

  it("suggests a meal type from custom time boundaries", () => {
    const boundaries = { breakfastEndsHour: 9, lunchEndsHour: 13, dinnerEndsHour: 18 };
    expect(suggestedMealType(new Date(2026, 6, 20, 8, 59), boundaries)).toBe("breakfast");
    expect(suggestedMealType(new Date(2026, 6, 20, 9, 0), boundaries)).toBe("lunch");
    expect(suggestedMealType(new Date(2026, 6, 20, 19, 0), boundaries)).toBe("snack");
  });

  it("applies a serving-size override for tbsp and tsp", () => {
    expect(gramsFor(food, 1, "tbsp", { tbspGrams: 14 })).toBe(14);
    expect(gramsFor(food, 1, "tsp", { tspGrams: 4 })).toBe(4);
    expect(gramsFor(food, 1, "tbsp")).toBe(15);
  });

  it("scales nutrition to a non-default macro precision", () => {
    expect(scaleNutrition(food.nutrientsPer100, 60, 0)).toMatchObject({ protein: 6, carbs: 12, fat: 5 });
    expect(scaleNutrition(food.nutrientsPer100, 60, 2)).toMatchObject({ protein: 6, fat: 4.8 });
  });

});
