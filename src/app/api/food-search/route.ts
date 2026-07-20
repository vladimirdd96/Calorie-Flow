import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const fields = [
  "code", "product_name", "generic_name", "brands", "quantity", "serving_size", "serving_quantity",
  "product_quantity", "image_front_small_url", "image_front_url", "nutrition_data_per", "nutriments",
].join(",");

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

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";
  if (query.length < 2 || query.length > 100) {
    return response({ error: "Search for between 2 and 100 characters." }, 400);
  }

  try {
    const products = productsFromSearchResponse(await searchOpenFoodFacts(query));
    if (!products) {
      return response({ error: "Open Food Facts returned an invalid search response." }, 502);
    }
    return response({ products });
  } catch {
    return response({ error: "Online food search is temporarily unavailable." }, 503);
  }
}
