import { contributeCatalogueProduct, findCatalogueProduct, normalizeBarcode, searchCatalogue } from "./product-catalogue";
import { findByBarcode, searchOpenFoodFacts } from "./openfoodfacts";
import type { Food } from "./types";

/**
 * Resolution order for a packaged food, from cheapest and most complete to least.
 *
 * The shared catalogue comes first because it is the only source that holds the
 * supermarket private labels the public databases miss, and because it keeps
 * answering when Open Food Facts is unavailable. `/api/food-search` fans the
 * remaining lookup out across Open Food Facts, Nutritionix and USDA FoodData Central.
 */

export type BarcodeLookup =
  | { status: "found"; food: Food; from: "catalogue" | "providers" }
  | { status: "not-found" }
  | { status: "unavailable" };

export async function lookupBarcode(code: string): Promise<BarcodeLookup> {
  const barcode = normalizeBarcode(code);
  const shared = await findCatalogueProduct(barcode);
  if (shared) return { status: "found", food: shared, from: "catalogue" };
  try {
    const food = await findByBarcode(barcode || code);
    return food ? { status: "found", food, from: "providers" } : { status: "not-found" };
  } catch {
    return { status: "unavailable" };
  }
}

/**
 * Publishes a product the user resolved themselves — an AI label read or a hand-typed
 * food carrying a barcode — so the next account scanning it gets an instant hit. Rows
 * that came out of the shared catalogue or a public provider are skipped: republishing
 * them would only duplicate what the lookup already found.
 */
export async function shareResolvedProduct(food: Food) {
  if (food.source !== "ai-label" && food.source !== "custom") return "skipped" as const;
  return contributeCatalogueProduct({ food, source: food.source });
}

/** Catalogue matches merged ahead of the online providers, deduped by barcode and id. */
export async function searchPackagedFoods(query: string): Promise<Food[]> {
  const [catalogue, remote] = await Promise.all([
    searchCatalogue(query),
    // A provider outage is only worth surfacing when the shared catalogue had nothing either.
    searchOpenFoodFacts(query).catch(() => null),
  ]);
  if (remote === null && !catalogue.length) throw new Error("Packaged food search is unavailable.");
  const seen = new Set<string>();
  return [...catalogue, ...(remote || [])].filter((food) => {
    const key = food.barcode ? `barcode:${food.barcode}` : `id:${food.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
