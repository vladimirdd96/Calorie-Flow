// Shared mock data for authored previews. Not a component — no @dsCard,
// never built directly (esbuild builds <Name>.tsx per component; this is
// just imported by them).
import type { Food, Meal, Profile, Recipe } from "calorie-flow-design-system";

export const noop = () => {};
export const asyncNoop = async () => {};

export const dateKey = "2026-07-22";

export const profile: Profile = {
  name: "Alex",
  sex: "female",
  age: 32,
  heightCm: 168,
  weightKg: 63,
  activity: "moderate",
  goalMode: "lose",
  dietPreset: "balanced",
  calorieTarget: 1850,
  proteinTarget: 130,
  carbsTarget: 180,
  fatTarget: 60,
  fiberTarget: 28,
  hideCalories: false,
  onboardingDone: true,
  carbDisplay: "total",
  planEnabled: true,
  recipes: [],
};

function meal(partial: Partial<Meal> & Pick<Meal, "id" | "name" | "mealType" | "nutrition">): Meal {
  return {
    amount: 1,
    unit: "serving",
    grams: 200,
    createdAt: `${dateKey}T08:00:00.000Z`,
    loggedDate: dateKey,
    source: "seed",
    ...partial,
  };
}

export const meals: Meal[] = [
  meal({ id: "m1", name: "Greek yogurt with berries", mealType: "breakfast", nutrition: { calories: 320, protein: 24, carbs: 38, fat: 8, fiber: 5, sugar: 22 } }),
  meal({ id: "m2", name: "Grilled chicken salad", mealType: "lunch", nutrition: { calories: 480, protein: 42, carbs: 28, fat: 20, fiber: 9, sugar: 6 } }),
  meal({ id: "m3", name: "Salmon, rice & broccoli", mealType: "dinner", nutrition: { calories: 610, protein: 48, carbs: 55, fat: 22, fiber: 7, sugar: 4 } }),
  meal({ id: "m4", name: "Almonds", mealType: "snack", nutrition: { calories: 160, protein: 6, carbs: 6, fat: 14, fiber: 3, sugar: 1 } }),
];

export const foods: Food[] = [
  { id: "f1", name: "Grilled chicken breast", brand: undefined, servingGrams: 150, servingLabel: "1 breast", nutrientsPer100: { calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sugar: 0 }, source: "seed", verified: true },
  { id: "f2", name: "Greek yogurt", brand: "Fage", servingGrams: 170, servingLabel: "1 cup", nutrientsPer100: { calories: 97, protein: 9, carbs: 4, fat: 5, fiber: 0, sugar: 4 }, source: "seed", verified: true },
  { id: "f3", name: "Brown rice, cooked", servingGrams: 195, servingLabel: "1 cup", nutrientsPer100: { calories: 112, protein: 2.6, carbs: 24, fat: 0.9, fiber: 1.8, sugar: 0.4 }, source: "food-data-central" },
];

export const recipes: Recipe[] = [
  {
    id: "r1",
    name: "Chicken & rice bowl",
    servings: 2,
    ingredients: [
      { id: "i1", name: "Grilled chicken breast", foodId: "f1", grams: 300, nutrition: { calories: 495, protein: 93, carbs: 0, fat: 10.8, fiber: 0, sugar: 0 } },
      { id: "i2", name: "Brown rice, cooked", foodId: "f3", grams: 390, nutrition: { calories: 437, protein: 10, carbs: 94, fat: 3.5, fiber: 7, sugar: 1.5 } },
    ],
    nutritionPerServing: { calories: 466, protein: 51, carbs: 47, fat: 7, fiber: 3.5, sugar: 0.8 },
    createdAt: `${dateKey}T10:00:00.000Z`,
    updatedAt: `${dateKey}T10:00:00.000Z`,
  },
];
