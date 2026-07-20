import { NextRequest, NextResponse } from "next/server";

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
      return response({ product: await findProductByBarcode(barcode) });
    } catch {
      return response({ error: "Online product lookup is temporarily unavailable." }, 503);
    }
  }

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
