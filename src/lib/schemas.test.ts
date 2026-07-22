import { describe, expect, it } from "vitest";
import { backupSchema, diaryShareSchema, labelAnalysisSchema, mealSchema, profileSchema } from "./schemas";

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

  it("accepts a unique saved habit selection and rejects repeated entries", () => {
    const profile = {
      name: "Sam",
      sex: "male" as const,
      age: 30,
      heightCm: 180,
      weightKg: 80,
      activity: "moderate" as const,
      goalMode: "maintain" as const,
      dietPreset: "balanced" as const,
      calorieTarget: 2500,
      proteinTarget: 150,
      carbsTarget: 300,
      fatTarget: 70,
      fiberTarget: 30,
      hideCalories: false,
      onboardingDone: true,
    };
    expect(profileSchema.parse({ ...profile, enabledHabitFeatures: ["water"] }).enabledHabitFeatures).toEqual(["water"]);
    expect(profileSchema.parse({ ...profile, planEnabled: false }).planEnabled).toBe(false);
    expect(() => profileSchema.parse({ ...profile, enabledHabitFeatures: ["water", "water"] })).toThrow("Habit features must not repeat");
  });

  it("only accepts a shared diary after it has a recipient", () => {
    const invitation = {
      id: "d4b47f94-9137-49aa-b5d4-e681bb1c3e17",
      ownerId: "9b85bc95-00c2-4dbd-9df1-e2458ececf51",
      recipientEmail: "friend@example.com",
      scope: "diary" as const,
      status: "accepted" as const,
      createdAt: "2026-07-22T12:00:00.000Z",
      acceptedAt: "2026-07-22T12:01:00.000Z",
    };
    expect(() => diaryShareSchema.parse(invitation)).toThrow("Accepted shares require a recipient.");
    expect(diaryShareSchema.parse({ ...invitation, recipientId: "a9d05ff0-b060-4e0f-944f-a1cc2a2d96d9" }).status).toBe("accepted");
  });
});
