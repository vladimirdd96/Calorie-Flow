import type { Food, Nutrition } from "./types";

type OffProduct = {
  code?: string;
  product_name?: string;
  generic_name?: string;
  brands?: string;
  quantity?: string;
  serving_size?: string;
  serving_quantity?: number;
  product_quantity?: number;
  image_front_small_url?: string;
  image_front_url?: string;
  nutrition_data_per?: string;
  nutriments?: Record<string, number | string | undefined>;
};

const fields = [
  "code", "product_name", "generic_name", "brands", "quantity", "serving_size", "serving_quantity",
  "product_quantity", "image_front_small_url", "image_front_url", "nutrition_data_per", "nutriments",
].join(",");

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value || "0"));
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapNutrition(product: OffProduct): Nutrition {
  const n = product.nutriments || {};
  const kilocalories = numberValue(n["energy-kcal_100g"]);
  const kilojoules = numberValue(n.energy_100g);
  return {
    calories: Math.round(kilocalories || kilojoules / 4.184 || 0),
    protein: numberValue(n.proteins_100g),
    carbs: numberValue(n.carbohydrates_100g),
    fat: numberValue(n.fat_100g),
    fiber: numberValue(n.fiber_100g),
    sugar: numberValue(n.sugars_100g),
  };
}

function hasNutritionData(product: OffProduct) {
  const nutrients = product.nutriments || {};
  return [
    "energy-kcal_100g", "energy_100g", "proteins_100g", "carbohydrates_100g", "fat_100g", "fiber_100g", "sugars_100g",
  ].some((key) => Object.hasOwn(nutrients, key) && Number.isFinite(Number(nutrients[key])));
}

function mapProduct(product: OffProduct): Food | null {
  const name = product.product_name || product.generic_name;
  const nutrition = mapNutrition(product);
  // A zero value is valid nutrition data: sugar-free drinks and water must not
  // disappear from packaged-food search just because they contain no calories.
  if (!name || !hasNutritionData(product)) return null;
  return {
    id: `off-${product.code || crypto.randomUUID()}`,
    name,
    brand: product.brands?.split(",")[0]?.trim(),
    barcode: product.code,
    quantityLabel: product.quantity,
    servingLabel: product.serving_size,
    servingGrams: numberValue(product.serving_quantity) || undefined,
    packageGrams: numberValue(product.product_quantity) || undefined,
    imageUrl: product.image_front_small_url || product.image_front_url,
    nutrientsPer100: nutrition,
    source: "open-food-facts",
  };
}

export async function findByBarcode(barcode: string): Promise<Food | null> {
  const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${fields}`);
  if (!response.ok) throw new Error("Product lookup failed");
  const data = await response.json();
  if (data.status !== 1 || !data.product) return null;
  return mapProduct({ ...data.product, code: data.code || barcode });
}

export async function searchOpenFoodFacts(query: string): Promise<Food[]> {
  const params = new URLSearchParams({
    action: "process",
    json: "true",
    search_terms: query,
    page_size: "50",
    fields,
  });
  const response = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params}`);
  if (!response.ok) throw new Error("Food search failed");
  const data = await response.json();
  return (data.products || []).map(mapProduct).filter(Boolean) as Food[];
}
