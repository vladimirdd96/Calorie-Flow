import { describe, expect, it } from "vitest";
import { backupSchema, diaryShareSchema, generatedRecipeSchema, labelAnalysisSchema, mealSchema, mealPlanEntrySchema, profileSchema, publicRecipeSchema, recipeNutritionEstimateSchema } from "./schemas";

const nutrition = { calories: 120, protein: 10, carbs: 12, fat: 4, fiber: 3, sugar: 2 };

describe("external data schemas", () => {
  it("accepts recipe and food meal plan entries", () => {
    expect(mealPlanEntrySchema.parse({ id: "plan-recipe", recipeId: "recipe-1", date: "2026-07-21", mealType: "dinner" })).toMatchObject({ recipeId: "recipe-1" });
    expect(mealPlanEntrySchema.parse({ id: "plan-food", foodId: "food-1", date: "2026-07-21", mealType: "snack" })).toMatchObject({ foodId: "food-1" });
    expect(() => mealPlanEntrySchema.parse({ id: "plan-invalid", recipeId: "recipe-1", foodId: "food-1", date: "2026-07-21", mealType: "dinner" })).toThrow();
  });
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

  it("accepts the legacy micronutrient-completeness flag from synced meals", () => {
    const meal = mealSchema.parse({
      id: "meal-with-micros",
      name: "Recipe meal",
      mealType: "dinner",
      amount: 1,
      unit: "serving",
      grams: 300,
      nutrition: { ...nutrition, micronutrientsIncomplete: true },
      createdAt: "2026-07-20T22:30:00.000Z",
      source: "custom",
    });
    expect(meal.nutrition.micronutrientsIncomplete).toBe(true);
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

describe("recipe catalogue schemas", () => {
  it("accepts a community public recipe and rejects negative nutrition", () => {
    const recipe = {
      id: "d4b47f94-9137-49aa-b5d4-e681bb1c3e17",
      name: "Lentil bowl",
      servings: 2,
      servingGrams: 350,
      ingredients: [{ id: "a", name: "Lentils" }],
      nutritionPerServing: nutrition,
      source: "community" as const,
      authorId: "9b85bc95-00c2-4dbd-9df1-e2458ececf51",
      instructions: ["Simmer lentils until tender."],
      dietaryTags: ["vegetarian" as const],
      createdAt: "2026-07-20T12:00:00.000Z",
    };
    expect(publicRecipeSchema.parse(recipe).source).toBe("community");
    expect(() => publicRecipeSchema.parse({ ...recipe, nutritionPerServing: { ...nutrition, calories: -1 } })).toThrow();
  });

  it("accepts an AI-sourced recipe with a hotlinked, credited photo and rejects an untrusted image URL", () => {
    const recipe = {
      id: "33333333-3333-3333-3333-333333333333",
      name: "Weeknight stir-fry",
      servings: 3,
      servingGrams: 300,
      ingredients: [{ id: "a", name: "Broccoli" }],
      nutritionPerServing: nutrition,
      imageUrl: "https://example.com/photo.jpg",
      imageCredit: { label: "Example Kitchen", sourceUrl: "https://example.com/recipe" },
      source: "ai" as const,
      instructions: ["Stir-fry broccoli over high heat until crisp-tender."],
      dietaryTags: ["vegan" as const],
      createdAt: "2026-07-20T12:00:00.000Z",
    };
    expect(publicRecipeSchema.parse(recipe).imageCredit?.label).toBe("Example Kitchen");
    expect(() => publicRecipeSchema.parse({ ...recipe, imageUrl: "not-a-url" })).toThrow();
  });

  it("validates the nutrition-estimate response shape", () => {
    expect(recipeNutritionEstimateSchema.parse({ nutritionPerServing: nutrition, confidence: "medium" }).confidence).toBe("medium");
    expect(() => recipeNutritionEstimateSchema.parse({ nutritionPerServing: nutrition, confidence: "certain" })).toThrow();
  });

  it("requires at least one ingredient for an AI-generated recipe candidate", () => {
    const candidate = { name: "Baked chicken and rice", servings: 4, servingGrams: 320, ingredients: ["Chicken breast", "Rice"], nutritionPerServing: nutrition, instructions: ["Bake chicken at 400°F until cooked through.", "Serve over rice."] };
    expect(generatedRecipeSchema.parse(candidate).ingredients).toHaveLength(2);
    expect(() => generatedRecipeSchema.parse({ ...candidate, ingredients: [] })).toThrow();
  });
});
