import { describe, expect, it } from "vitest";
import { calculateMacroTargets, gramsFor, netCarbs, resolveDailyTargets, resolveMealCalorieTarget, scaleNutrition, startOfWeek, sumNutrition, suggestedMealType } from "./nutrition";
import type { Food } from "./types";

const food: Food = {
  id: "test",
  name: "Test food",
  servingGrams: 60,
  packageGrams: 180,
  nutrientsPer100: { calories: 200, protein: 10, carbs: 20, fat: 8, fiber: 4, sugar: 2 },
  source: "custom",
};

const macroBase = { calories: 2900, weightKg: 84, heightCm: 191, goalMode: "maintain" as const, preset: "balanced" as const };

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

  it("keeps keto carbs low", () => {
    expect(calculateMacroTargets({ ...macroBase, calories: 2900, preset: "high-protein-keto" }).carbs).toBe(30);
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

  it("raises protein on a cut and leaves it alone at maintenance", () => {
    const maintaining = calculateMacroTargets({ ...macroBase, goalMode: "maintain" });
    const cutting = calculateMacroTargets({ ...macroBase, goalMode: "lose" });
    expect(cutting.protein).toBeGreaterThan(maintaining.protein);
  });

  it("scales protein off lean mass rather than a high current weight", () => {
    const heavy = { ...macroBase, weightKg: 120, heightCm: 175, goalMode: "lose" as const };
    const withoutGoal = calculateMacroTargets(heavy);
    const withGoal = calculateMacroTargets({ ...heavy, goalWeightKg: 80 });
    // Raw bodyweight would ask for 264 g. Both paths stay far below that.
    expect(withoutGoal.protein).toBeLessThan(180);
    expect(withGoal.protein).toBeLessThan(180);
    // A stated goal weight is the better proxy, so it becomes the basis outright.
    expect(withGoal.protein).toBe(Math.round((80 * 2.2) / 5) * 5);
  });

  it("keeps a preset override above the goal-bonus cap", () => {
    const overridden = calculateMacroTargets({ ...macroBase, goalMode: "lose", overrides: { balanced: { proteinPerKg: 3 } } });
    expect(overridden.protein).toBe(Math.round((84 * 3) / 5) * 5);
  });

  it("holds fat at a floor instead of letting a preset drive it to nothing", () => {
    const lowFat = calculateMacroTargets({ ...macroBase, calories: 1400, preset: "low-fat" });
    expect(lowFat.fat).toBeGreaterThanOrEqual(30);
  });

  it("reconciles macros against the calorie target rather than overshooting it", () => {
    for (const calories of [1400, 1800, 2200, 2900]) {
      for (const preset of ["balanced", "high-protein", "low-fat"] as const) {
        const macros = calculateMacroTargets({ ...macroBase, calories, preset, goalMode: "lose" });
        const total = macros.protein * 4 + macros.carbs * 4 + macros.fat * 9;
        expect(Math.abs(total - calories - macros.shortfallKcal)).toBeLessThanOrEqual(10);
      }
    }
  });

  it("trims fat then protein so a tight target still fits", () => {
    const tight = calculateMacroTargets({ calories: 900, weightKg: 120, heightCm: 175, goalMode: "lose", preset: "high-protein" });
    expect(tight.shortfallKcal).toBe(0);
    expect(tight.protein * 4 + tight.carbs * 4 + tight.fat * 9).toBeLessThanOrEqual(910);
  });

  it("reports the calories a preset cannot fit instead of hiding a zeroed carb target", () => {
    // Below the protein and fat floors combined, nothing can be trimmed further.
    const impossible = calculateMacroTargets({ calories: 700, weightKg: 120, heightCm: 175, goalMode: "lose", preset: "high-protein" });
    expect(impossible.carbs).toBe(0);
    expect(impossible.shortfallKcal).toBeGreaterThan(0);
  });

  it("merges a macro preset override onto the base rule", () => {
    const defaultResult = calculateMacroTargets({ ...macroBase, calories: 2900, preset: "balanced" });
    const overridden = calculateMacroTargets({ ...macroBase, calories: 2900, preset: "balanced", overrides: { balanced: { proteinPerKg: 2.5 } } });
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
