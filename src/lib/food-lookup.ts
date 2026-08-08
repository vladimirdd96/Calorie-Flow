import { contributeCatalogueProduct, correctCatalogueProduct, findCatalogueProduct, searchCatalogue } from "./product-catalogue";
import { gtinVariants } from "./gtin";
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
  // Databases disagree about how to spell the same GTIN — Open Food Facts pads a UPC-A
  // to thirteen digits, Nutritionix does not — so every equivalent form is tried before
  // concluding that nobody has the package.
  const variants = gtinVariants(code);
  if (!variants.length) return { status: "not-found" };

  const shared = await findCatalogueProduct(variants);
  if (shared) return { status: "found", food: shared, from: "catalogue" };

  let providerFailed = false;
  for (const variant of variants) {
    try {
      const food = await findByBarcode(variant);
      if (food) return { status: "found", food, from: "providers" };
    } catch {
      providerFailed = true;
    }
  }
  return providerFailed ? { status: "unavailable" } : { status: "not-found" };
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

/**
 * Fixes a name already published under a barcode. Renaming a food in the portion sheet is
 * a quiet correction, not a new contribution, so this updates rather than inserts and never
 * touches foods that came from Open Food Facts or another public provider — the app has no
 * authority to rewrite those, only the row a user's own scan created.
 */
export async function correctResolvedProductName(food: Food) {
  if ((food.source !== "ai-label" && food.source !== "custom") || !food.barcode) return;
  await correctCatalogueProduct(food.barcode, food.name);
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
