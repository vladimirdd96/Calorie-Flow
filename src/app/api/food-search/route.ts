import { NextRequest, NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";

const fields = [
  "code", "product_name", "generic_name", "brands", "quantity", "serving_size", "serving_quantity",
  "product_quantity", "image_front_small_url", "image_front_url", "nutrition_data_per", "nutriments",
].join(",");

function normalizeBarcode(value: string) {
  return value.replace(/\D/g, "");
}

function response(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, max-age=120" } });
}

function productsFromSearchResponse(value: unknown): Record<string, unknown>[] | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as { hits?: unknown; products?: unknown };
  const products = Array.isArray(payload.hits) ? payload.hits : payload.products;
  if (!Array.isArray(products) || products.some((product) => !product || typeof product !== "object" || Array.isArray(product))) return null;
  return products.map((product) => {
    const record = product as Record<string, unknown>;
    return {
      ...record,
      brands: Array.isArray(record.brands) ? record.brands.filter((brand): brand is string => typeof brand === "string").join(",") : record.brands,
    };
  });
}

function fdcProductsFromResponse(value: unknown): Record<string, unknown>[] {
  if (!value || typeof value !== "object" || !Array.isArray((value as { foods?: unknown }).foods)) return [];
  return (value as { foods: unknown[] }).foods.filter((food): food is Record<string, unknown> => Boolean(food) && typeof food === "object" && !Array.isArray(food)).map((food) => ({ ...food, _source: "food-data-central" }));
}

async function searchOpenFoodFacts(query: string): Promise<unknown> {
  const params = new URLSearchParams({
    action: "process",
    json: "true",
    search_terms: query,
    page_size: "50",
    fields,
  });
  const searchUrl = new URL("https://search.openfoodfacts.org/search");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("page_size", "50");
  searchUrl.searchParams.set("fields", fields);
  searchUrl.searchParams.set("boost_phrase", "true");
  searchUrl.searchParams.set("lc", "bg,en");
  searchUrl.searchParams.set("cc", "bg");
  searchUrl.searchParams.set("countries_tags_en", "Bulgaria");
  params.set("lc", "bg,en");
  params.set("cc", "bg");
  const legacyUrl = `https://world.openfoodfacts.org/cgi/search.pl?${params}`;

  for (const url of [searchUrl, legacyUrl]) {
    const upstream = await fetch(url, {
      headers: { "User-Agent": "Calorie Flow/1.0 (food-search)" },
      cache: "no-store",
    });
    if (upstream.ok) return upstream.json();
  }
  throw new Error("Open Food Facts search is unavailable");
}

async function searchFoodDataCentral(query: string): Promise<Record<string, unknown>[]> {
  if (!serverEnv.FDC_API_KEY) return [];
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", serverEnv.FDC_API_KEY);
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", "25");
  url.searchParams.set("dataType", "Branded");
  const upstream = await fetch(url, { headers: { "User-Agent": "Calorie Flow/1.0 (food-search)" }, cache: "no-store" });
  if (!upstream.ok) return [];
  return fdcProductsFromResponse(await upstream.json());
}

function nutritionixHeaders() {
  return {
    "User-Agent": "Calorie Flow/1.0 (food-search)",
    "x-app-id": serverEnv.NUTRITIONIX_APP_ID || "",
    "x-app-key": serverEnv.NUTRITIONIX_APP_KEY || "",
  };
}

async function searchRestaurantMenus(query: string): Promise<Record<string, unknown>[]> {
  if (!serverEnv.NUTRITIONIX_APP_ID || !serverEnv.NUTRITIONIX_APP_KEY) return [];
  const url = new URL("https://trackapi.nutritionix.com/v2/search/instant");
  url.searchParams.set("query", query);
  const upstream = await fetch(url, { headers: nutritionixHeaders(), cache: "no-store" });
  if (!upstream.ok) return [];
  const payload: unknown = await upstream.json();
  if (!payload || typeof payload !== "object") return [];
  const branded = (payload as { branded?: unknown }).branded;
  if (!Array.isArray(branded)) return [];
  const candidates = branded
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .filter((item) => typeof item.nix_item_id === "string")
    .slice(0, 12);
  const items: Array<Record<string, unknown> | null> = await Promise.all(candidates.map(async (candidate) => {
    const itemUrl = new URL("https://trackapi.nutritionix.com/v2/search/item");
    itemUrl.searchParams.set("nix_item_id", String(candidate.nix_item_id));
    const itemResponse = await fetch(itemUrl, { headers: nutritionixHeaders(), cache: "no-store" });
    if (!itemResponse.ok) return null;
    const itemPayload: unknown = await itemResponse.json();
    if (!itemPayload || typeof itemPayload !== "object" || !Array.isArray((itemPayload as { foods?: unknown }).foods)) return null;
    const item = (itemPayload as { foods: unknown[] }).foods[0];
    return item && typeof item === "object" && !Array.isArray(item) ? { ...(item as Record<string, unknown>), _source: "restaurant" } : null;
  }));
  return items.filter((item): item is Record<string, unknown> => item !== null);
}

async function findProductByBarcode(barcode: string): Promise<unknown> {
  const url = new URL(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("lc", "bg,en");
  url.searchParams.set("cc", "bg");
  const upstream = await fetch(url, { headers: { "User-Agent": "Calorie Flow/1.0 (food-search)" }, cache: "no-store" });
  if (!upstream.ok) throw new Error("Open Food Facts product lookup failed");
  const data = await upstream.json();
  if (!data || typeof data !== "object" || data.status !== 1 || !data.product || typeof data.product !== "object") return null;
  return { ...data.product, code: data.code || barcode };
}

export async function GET(request: NextRequest) {
  const barcode = normalizeBarcode(request.nextUrl.searchParams.get("barcode")?.trim() || "");
  if (barcode.length >= 8 && barcode.length <= 18) {
    try {
      const [openFoodFactsProduct, foodDataCentralProducts] = await Promise.all([
        findProductByBarcode(barcode).catch(() => null),
        searchFoodDataCentral(barcode),
      ]);
      return response({ product: openFoodFactsProduct, products: [openFoodFactsProduct, ...foodDataCentralProducts].filter(Boolean) });
    } catch {
      return response({ error: "Online product lookup is temporarily unavailable." }, 503);
    }
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() || "";
  if (query.length < 2 || query.length > 100) {
    return response({ error: "Search for between 2 and 100 characters." }, 400);
  }

  try {
    const [openFoodFactsProducts, foodDataCentralProducts, restaurantProducts] = await Promise.all([
      searchOpenFoodFacts(query).then(productsFromSearchResponse).catch(() => []),
      searchFoodDataCentral(query).catch(() => []),
      searchRestaurantMenus(query).catch(() => []),
    ]);
    if (!openFoodFactsProducts?.length && !foodDataCentralProducts.length && !restaurantProducts.length) return response({ products: [] });
    return response({ products: [...restaurantProducts, ...(openFoodFactsProducts || []), ...foodDataCentralProducts] });
  } catch {
    return response({ error: "Online food search is temporarily unavailable." }, 503);
  }
}
