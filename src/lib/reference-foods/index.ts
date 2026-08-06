import type { Food } from "../types";
import { bulgarianFoods } from "./bulgarian";
import { drinkFoods } from "./drinks";
import { europeanFoods } from "./european";
import { pantryFoods } from "./pantry";

export { referenceFoodId } from "./builder";

/**
 * Reference foods the online product catalogues cannot answer for: cooked
 * dishes, poured drinks and unbranded single foods. Each row carries local
 * keywords so a Bulgarian or Cyrillic search term reaches the English name.
 */
export const referenceFoods: Food[] = [...bulgarianFoods, ...europeanFoods, ...drinkFoods, ...pantryFoods];
