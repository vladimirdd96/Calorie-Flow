import type { Food, Nutrition } from "./types";

type OffProduct = {
  _source?: never;
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

type FdcProduct = {
  fdcId?: number;
  description?: string;
  brandOwner?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: Array<{ nutrientId?: number; value?: number }>;
  _source?: "food-data-central";
};

const searchCache = new Map<string, { expiresAt: number; foods: Food[] }>();
const SEARCH_CACHE_TTL_MS = 2 * 60_000;

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value || "0"));
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapNutrition(product: OffProduct): Nutrition {
  const n = product.nutriments || {};
  const kilocalories = numberValue(n["energy-kcal_100g"]);
  const kilojoules = numberValue(n.energy_100g);
  const micronutrients = {
    sodiumMg: numberValue(n.sodium_100g) * 1000,
    cholesterolMg: numberValue(n.cholesterol_100g),
    saturatedFatG: numberValue(n["saturated-fat_100g"]),
    potassiumMg: numberValue(n.potassium_100g),
    calciumMg: numberValue(n.calcium_100g),
    ironMg: numberValue(n.iron_100g),
    magnesiumMg: numberValue(n.magnesium_100g),
    zincMg: numberValue(n.zinc_100g),
    vitaminAMcg: numberValue(n["vitamin-a_100g"]),
    vitaminCMg: numberValue(n["vitamin-c_100g"]),
    vitaminDMcg: numberValue(n["vitamin-d_100g"]),
    vitaminEMg: numberValue(n["vitamin-e_100g"]),
    vitaminKMcg: numberValue(n["vitamin-k_100g"]),
    vitaminB12Mcg: numberValue(n["vitamin-b12_100g"]),
    folateMcg: numberValue(n.folates_100g),
  };
  return {
    calories: Math.round(kilocalories || kilojoules / 4.184 || 0),
    protein: numberValue(n.proteins_100g),
    carbs: numberValue(n.carbohydrates_100g),
    fat: numberValue(n.fat_100g),
    fiber: numberValue(n.fiber_100g),
    sugar: numberValue(n.sugars_100g),
    micronutrients: Object.values(micronutrients).some(Boolean) ? micronutrients : undefined,
  };
}

function mapFdcNutrition(product: FdcProduct): Nutrition {
  const nutrients = new Map((product.foodNutrients || []).map((nutrient) => [nutrient.nutrientId, numberValue(nutrient.value)]));
  const micronutrients = {
    sodiumMg: nutrients.get(1093) || 0, cholesterolMg: nutrients.get(1253) || 0, saturatedFatG: nutrients.get(1258) || 0,
    potassiumMg: nutrients.get(1092) || 0, calciumMg: nutrients.get(1087) || 0, ironMg: nutrients.get(1089) || 0,
    magnesiumMg: nutrients.get(1090) || 0, zincMg: nutrients.get(1095) || 0, vitaminAMcg: nutrients.get(1106) || 0,
    vitaminCMg: nutrients.get(1162) || 0, vitaminDMcg: nutrients.get(1114) || 0, vitaminEMg: nutrients.get(1109) || 0,
    vitaminKMcg: nutrients.get(1185) || 0, vitaminB12Mcg: nutrients.get(1178) || 0, folateMcg: nutrients.get(1177) || 0,
  };
  return {
    calories: Math.round(nutrients.get(1008) || 0),
    protein: nutrients.get(1003) || 0,
    carbs: nutrients.get(1005) || 0,
    fat: nutrients.get(1004) || 0,
    fiber: nutrients.get(1079) || 0,
    sugar: nutrients.get(2000) || 0,
    micronutrients: Object.values(micronutrients).some(Boolean) ? micronutrients : undefined,
  };
}

function hasNutritionData(product: OffProduct) {
  const nutrients = product.nutriments || {};
  return [
    "energy-kcal_100g", "energy_100g", "proteins_100g", "carbohydrates_100g", "fat_100g", "fiber_100g", "sugars_100g",
  ].some((key) => Object.hasOwn(nutrients, key) && Number.isFinite(Number(nutrients[key])));
}

function mapFdcProduct(product: FdcProduct): Food | null {
  if (!product.description || !product.fdcId) return null;
  const nutrition = mapFdcNutrition(product);
  if (!nutrition.calories && !nutrition.protein && !nutrition.carbs && !nutrition.fat) return null;
  return {
    id: `fdc-${product.fdcId}`,
    name: product.description,
    brand: product.brandOwner,
    barcode: product.gtinUpc,
    servingGrams: product.servingSizeUnit?.toLowerCase() === "g" ? product.servingSize : undefined,
    nutrientsPer100: nutrition,
    source: "food-data-central",
  };
}

function mapProduct(product: OffProduct | FdcProduct): Food | null {
  if (product._source === "food-data-central") return mapFdcProduct(product);
  const offProduct = product as OffProduct;
  const name = offProduct.product_name || offProduct.generic_name;
  const nutrition = mapNutrition(offProduct);
  // A zero value is valid nutrition data: sugar-free drinks and water must not
  // disappear from packaged-food search just because they contain no calories.
  if (!name || !hasNutritionData(offProduct)) return null;
  return {
    id: `off-${offProduct.code || crypto.randomUUID()}`,
    name,
    brand: offProduct.brands?.split(",")[0]?.trim(),
    barcode: offProduct.code,
    quantityLabel: offProduct.quantity,
    servingLabel: offProduct.serving_size,
    servingGrams: numberValue(offProduct.serving_quantity) || undefined,
    packageGrams: numberValue(offProduct.product_quantity) || undefined,
    imageUrl: offProduct.image_front_small_url || offProduct.image_front_url,
    nutrientsPer100: nutrition,
    source: "open-food-facts",
  };
}

export async function findByBarcode(barcode: string): Promise<Food | null> {
  const response = await fetch(`/api/food-search?barcode=${encodeURIComponent(barcode)}`);
  if (!response.ok) throw new Error("Product lookup failed");
  const data: unknown = await response.json();
  if (!data || typeof data !== "object") return null;
  const record = data as { products?: unknown; product?: unknown };
  const products = Array.isArray(record.products) ? record.products : record.product ? [record.product] : [];
  return products.filter((product): product is Record<string, unknown> => Boolean(product) && typeof product === "object" && !Array.isArray(product))
    .map((product) => mapProduct({ ...product, code: product.code || barcode } as OffProduct | FdcProduct)).find(Boolean) || null;
}

export async function searchOpenFoodFacts(query: string): Promise<Food[]> {
  const normalizedQuery = query.trim();
  const cacheKey = normalizedQuery.toLocaleLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.foods;

  const response = await fetch(`/api/food-search?q=${encodeURIComponent(normalizedQuery)}`);
  if (!response.ok) throw new Error("Food search failed");
  const data = await response.json();
  const foods = (data.products || []).map(mapProduct).filter(Boolean) as Food[];
  searchCache.set(cacheKey, { foods, expiresAt: Date.now() + SEARCH_CACHE_TTL_MS });
  return foods;
}
