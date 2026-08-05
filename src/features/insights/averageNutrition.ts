import { scaleNutrition, sumNutrition } from "../../lib/nutrition";
import type { Nutrition } from "../../lib/types";

export function averageNutritionFor(items: Nutrition[], macroDigits = 1) {
  if (!items.length) return sumNutrition([]);
  return scaleNutrition(sumNutrition(items), 100 / items.length, macroDigits);
}
