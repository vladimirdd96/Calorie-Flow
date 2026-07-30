import { scaleNutrition, sumNutrition } from "../../lib/nutrition";
import type { Nutrition } from "../../lib/types";

export function averageNutritionFor(items: Nutrition[]) {
  if (!items.length) return sumNutrition([]);
  return scaleNutrition(sumNutrition(items), 100 / items.length);
}
