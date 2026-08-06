import type { Food } from "../types";

/**
 * Nutrients per 100 g of the food as eaten. Drinks use per 100 ml, which the app
 * treats as 100 g: every drink listed here is close enough to water density that
 * the difference is smaller than the recipe-to-recipe variation.
 */
export type ReferenceNutrients = readonly [calories: number, protein: number, carbs: number, fat: number, fiber: number, sugar: number];

export type ReferenceFoodOptions = {
  /** Weight of one countable unit, for foods normally counted rather than weighed. */
  pieceGrams?: number;
  /**
   * Only single-ingredient foods with published composition data are verified.
   * Prepared dishes and mixed drinks stay estimates, so meals logged from them
   * are flagged as estimated in the diary.
   */
  verified?: boolean;
};

export type ReferenceFoodRow = readonly [
  name: string,
  /** Comma-separated local names, Cyrillic spellings and synonyms. Search-only; never displayed. */
  keywords: string,
  servingGrams: number,
  servingLabel: string,
  nutrients: ReferenceNutrients,
  options?: ReferenceFoodOptions,
];

export function referenceFoodId(name: string) {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `seed-${slug}`;
}

export function buildReferenceFoods(rows: readonly ReferenceFoodRow[]): Food[] {
  return rows.map(([name, keywords, servingGrams, servingLabel, [calories, protein, carbs, fat, fiber, sugar], options]) => ({
    id: referenceFoodId(name),
    name,
    servingGrams,
    servingLabel,
    ...(options?.pieceGrams ? { pieceGrams: options.pieceGrams } : {}),
    ...(options?.verified ? { verified: true } : {}),
    keywords: keywords.split(",").map((keyword) => keyword.trim()).filter(Boolean),
    nutrientsPer100: { calories, protein, carbs, fat, fiber, sugar },
    source: "seed",
  }));
}
