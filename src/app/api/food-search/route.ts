import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const fields = [
  "code", "product_name", "generic_name", "brands", "quantity", "serving_size", "serving_quantity",
  "product_quantity", "image_front_small_url", "image_front_url", "nutrition_data_per", "nutriments",
].join(",");

function response(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, max-age=120" } });
}

function isSearchResponse(value: unknown): value is { products: Record<string, unknown>[] } {
  return !!value
    && typeof value === "object"
    && Array.isArray((value as { products?: unknown }).products)
    && (value as { products: unknown[] }).products.every((product) => !!product && typeof product === "object" && !Array.isArray(product));
}

async function searchOpenFoodFacts(query: string): Promise<unknown> {
  const params = new URLSearchParams({
    action: "process",
    json: "true",
    search_terms: query,
    page_size: "50",
    fields,
  });
  const url = `https://world.openfoodfacts.org/cgi/search.pl?${params}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const upstream = await fetch(url, {
      headers: { "User-Agent": "Calorie Flow/1.0 (food-search)" },
      cache: "no-store",
    });
    if (upstream.ok) return upstream.json();
    if (upstream.status < 500 || attempt === 1) throw new Error(`Open Food Facts returned ${upstream.status}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";
  if (query.length < 2 || query.length > 100) {
    return response({ error: "Search for between 2 and 100 characters." }, 400);
  }

  try {
    const data = await searchOpenFoodFacts(query);
    if (!isSearchResponse(data)) {
      return response({ error: "Open Food Facts returned an invalid search response." }, 502);
    }
    return response(data);
  } catch {
    return response({ error: "Online food search is temporarily unavailable." }, 503);
  }
}
