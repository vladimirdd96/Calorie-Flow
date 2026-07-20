import { describe, expect, it } from "vitest";
import { backupSchema, labelAnalysisSchema, mealSchema } from "./schemas";

const nutrition = { calories: 120, protein: 10, carbs: 12, fat: 4, fiber: 3, sugar: 2 };

describe("external data schemas", () => {
  it("accepts a local logged date that is independent of its storage timestamp", () => {
    const meal = mealSchema.parse({
      id: "meal-1",
      name: "Late snack",
      mealType: "snack",
      amount: 1,
      unit: "serving",
      grams: 50,
      nutrition,
      createdAt: "2026-07-20T22:30:00.000Z",
      loggedDate: "2026-07-21",
      source: "custom",
    });
    expect(meal.loggedDate).toBe("2026-07-21");
  });

  it("rejects negative nutrition from cloud or AI boundaries", () => {
    expect(() => labelAnalysisSchema.parse({
      productName: "Broken label",
      brand: null,
      barcode: null,
      per100: { ...nutrition, calories: -1 },
      servingSizeG: null,
      packageSizeG: null,
      confidence: "low",
      needsFollowUp: false,
      followUpQuestions: [],
    })).toThrow();
  });

  it("rejects a backup with implausible profile values", () => {
    expect(() => backupSchema.parse({
      version: 1,
      exportedAt: "2026-07-20T12:00:00.000Z",
      meals: [],
      foods: [],
      profile: {
        name: "",
        sex: "male",
        age: 0,
        heightCm: 180,
        weightKg: 80,
        activity: "moderate",
        goalMode: "maintain",
        dietPreset: "balanced",
        calorieTarget: 2500,
        proteinTarget: 150,
        carbsTarget: 300,
        fatTarget: 70,
        fiberTarget: 30,
        hideCalories: false,
        onboardingDone: true,
      },
    })).toThrow();
  });
});
