import type { Food } from "./types";

/**
 * Single source of truth for what text a food can be found by. Reference foods
 * carry local-language keywords (for example the Cyrillic "шопска салата") that
 * never appear in the displayed name, so every search surface must look here
 * rather than concatenating fields itself.
 */
export function foodSearchText(food: Food) {
  return [food.name, food.brand, food.barcode, ...(food.keywords || [])].filter(Boolean).join(" ").toLocaleLowerCase();
}

/** `normalizedQuery` must already be trimmed and lowercased by the caller. */
export function foodMatchesQuery(food: Food, normalizedQuery: string) {
  if (!normalizedQuery) return false;
  return foodSearchText(food).includes(normalizedQuery);
}
