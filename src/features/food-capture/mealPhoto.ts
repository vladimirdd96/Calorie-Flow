import { localDateKey } from "@/lib/nutrition";
import { roundDecimal } from "@/lib/decimal";
import type { Meal, MealPhotoAnalysis, MealPhotoItem, MealType, Nutrition } from "@/lib/types";

/** Multipliers behind the "Smaller / As shown / Larger" review chips. */
export const portionScales = [
  { id: "smaller", label: "Smaller", factor: 0.75 },
  { id: "shown", label: "As shown", factor: 1 },
  { id: "larger", label: "Larger", factor: 1.5 },
] as const;

export type PortionScaleId = (typeof portionScales)[number]["id"];

/** A photo item plus the review state the user controls before logging. */
export type ReviewItem = MealPhotoItem & { id: string; included: boolean };

const emptyNutrition: Nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 };

function factorNutrition(nutrition: Nutrition, factor: number): Nutrition {
  const scaled: Nutrition = {
    calories: roundDecimal(nutrition.calories * factor),
    protein: roundDecimal(nutrition.protein * factor),
    carbs: roundDecimal(nutrition.carbs * factor),
    fat: roundDecimal(nutrition.fat * factor),
    fiber: roundDecimal(nutrition.fiber * factor),
    sugar: roundDecimal(nutrition.sugar * factor),
  };
  if (nutrition.micronutrientsIncomplete) scaled.micronutrientsIncomplete = true;
  return scaled;
}

export function reviewItems(analysis: MealPhotoAnalysis): ReviewItem[] {
  return analysis.items.map((item, index) => ({ ...item, id: `${index}-${item.name}`, included: true }));
}

/**
 * Re-weighs one item. The model returns nutrition for the grams it saw, so a user
 * correcting the weight scales the macros with it rather than editing six fields.
 */
export function resizeItem(item: ReviewItem, grams: number): ReviewItem {
  const nextGrams = roundDecimal(Math.max(1, grams));
  if (item.grams <= 0) return { ...item, grams: nextGrams };
  return { ...item, grams: nextGrams, nutrition: factorNutrition(item.nutrition, nextGrams / item.grams) };
}

export function scaleItems(items: ReviewItem[], factor: number): ReviewItem[] {
  return items.map((item) => resizeItem(item, item.grams * factor));
}

export function mealPhotoTotals(items: ReviewItem[]) {
  const included = items.filter((item) => item.included);
  const nutrition = included.reduce<Nutrition>((total, item) => ({
    calories: total.calories + item.nutrition.calories,
    protein: total.protein + item.nutrition.protein,
    carbs: total.carbs + item.nutrition.carbs,
    fat: total.fat + item.nutrition.fat,
    fiber: total.fiber + item.nutrition.fiber,
    sugar: total.sugar + item.nutrition.sugar,
  }), { ...emptyNutrition });
  return {
    count: included.length,
    grams: roundDecimal(included.reduce((total, item) => total + item.grams, 0)),
    nutrition: factorNutrition(nutrition, 1),
  };
}

/** Names the diary entry after the dish, falling back to what the user kept on the plate. */
export function mealPhotoName(dish: string, items: ReviewItem[]) {
  const included = items.filter((item) => item.included);
  const name = dish.trim() || included.map((item) => item.name).join(", ");
  return (name || "Meal from photo").slice(0, 240);
}

export function mealFromPhoto({ items, dish, mealType, loggedDate, imageUrl }: {
  items: ReviewItem[];
  dish: string;
  mealType: MealType;
  loggedDate: string;
  imageUrl?: string;
}): Meal {
  const totals = mealPhotoTotals(items);
  return {
    id: `photo-${crypto.randomUUID()}`,
    name: mealPhotoName(dish, items),
    mealType,
    amount: 1,
    unit: "serving",
    grams: Math.max(1, totals.grams),
    nutrition: totals.nutrition,
    createdAt: loggedDate === localDateKey() ? new Date().toISOString() : new Date(`${loggedDate}T12:00:00`).toISOString(),
    loggedDate,
    imageUrl,
    source: "custom",
    // A photo estimate is never a measured value, however confident the model sounded.
    estimated: true,
  };
}
