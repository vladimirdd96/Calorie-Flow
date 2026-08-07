import { getCloudflareContext } from "@opennextjs/cloudflare";
import { toGtin14 } from "./gtin";

/**
 * Read side of the product mirror: the whole Open Food Facts dataset, sharded by a hash of
 * each product's canonical GTIN-14 and shipped as Worker static assets.
 *
 * It exists because the live Open Food Facts API is not dependable enough to be the only
 * answer to a barcode — it returned "Page temporarily unavailable" repeatedly while this
 * was being built. Static assets were chosen over R2 or a second database because they
 * need no new service, no separate account, and no payment method: the Worker already
 * ships an `ASSETS` binding, and the free plan allows 20,000 files per version at 25 MiB
 * each, which 4,096 shards of roughly 60 KB sit well inside.
 *
 * The mirror is queried alongside the live providers rather than instead of them: live
 * data wins when it arrives, since it carries micronutrients the mirror drops to stay
 * small, and the mirror answers when it does not.
 *
 * Shard layout is defined once in scripts/catalogue/shard.mjs and mirrored here. The hash
 * must stay identical in both places; product-mirror.test.ts pins known values.
 */

const SHARD_COUNT = 4096;
/** Hot shards stay parsed in isolate memory; a scan session hits the same few repeatedly. */
const SHARD_CACHE_LIMIT = 6;
/** Asset path prefix the build step copies shards into. */
const MIRROR_PREFIX = "/catalogue";

type ProductTuple = [
  gtin14: string, name: string, brand: string | null, calories: number, protein: number,
  carbs: number, fat: number, fiber: number, sugar: number,
  servingGrams: number | null, packageGrams: number | null, imageUrl: string | null,
];

type AssetsBinding = { fetch(request: Request): Promise<Response> };

const shardCache = new Map<string, ProductTuple[]>();

/** FNV-1a, kept byte-for-byte in step with scripts/catalogue/shard.mjs. */
export function shardIndex(gtin14: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < gtin14.length; index += 1) {
    hash ^= gtin14.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % SHARD_COUNT;
}

export function shardKey(gtin14: string) {
  return `${MIRROR_PREFIX}/p/${shardIndex(gtin14).toString(16).padStart(3, "0")}.json.gz`;
}

function isAssetsBinding(value: unknown): value is AssetsBinding {
  return Boolean(value) && typeof value === "object" && typeof (value as AssetsBinding).fetch === "function";
}

async function getAssets(): Promise<AssetsBinding | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const assets = (env as Record<string, unknown>).ASSETS;
    return isAssetsBinding(assets) ? assets : null;
  } catch {
    // No Cloudflare context during `next dev` or tests; the mirror is simply absent.
    return null;
  }
}

async function loadShard(key: string): Promise<ProductTuple[] | null> {
  const cached = shardCache.get(key);
  if (cached) return cached;
  const assets = await getAssets();
  if (!assets) return null;
  // The hostname is ignored by the assets binding; only the path selects the file.
  const response = await assets.fetch(new Request(`https://assets.local${key}`));
  if (!response.ok || !response.body) return null;
  // Shards are stored gzipped to keep the deploy small. The assets binding hands back
  // exactly the stored bytes, so the Worker decompresses them itself.
  const tuples: unknown = await new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).json();
  if (!Array.isArray(tuples)) return null;
  const shard = tuples as ProductTuple[];
  // Bounded FIFO: an isolate serving many users must not accumulate shards forever.
  if (shardCache.size >= SHARD_CACHE_LIMIT) shardCache.delete(shardCache.keys().next().value as string);
  shardCache.set(key, shard);
  return shard;
}

/**
 * Re-emits a mirrored product in the shape the Open Food Facts mapper already understands,
 * so a mirror hit and a live hit produce an identically sourced food. That is honest
 * labelling, not a shortcut: the mirror *is* Open Food Facts, just a snapshot of it.
 */
function tupleToOpenFoodFactsProduct(tuple: ProductTuple) {
  const [gtin14, name, brand, calories, protein, carbs, fat, fiber, sugar, servingGrams, packageGrams, imageUrl] = tuple;
  return {
    code: gtin14.replace(/^0+(?=\d{8})/, ""),
    product_name: name,
    brands: brand || undefined,
    serving_quantity: servingGrams || undefined,
    product_quantity: packageGrams || undefined,
    image_front_small_url: imageUrl || undefined,
    nutriments: {
      "energy-kcal_100g": calories,
      proteins_100g: protein,
      carbohydrates_100g: carbs,
      fat_100g: fat,
      fiber_100g: fiber,
      sugars_100g: sugar,
    },
  };
}

/**
 * Looks a barcode up in the mirror. Returns null for a miss, an unconfigured binding, or
 * any read failure — the live providers remain the answer in every one of those cases.
 */
export async function findMirrorProduct(barcode: string): Promise<Record<string, unknown> | null> {
  try {
    // Every equivalent GTIN spelling canonicalizes to the same 14 digits, so one shard
    // read covers a package filed under its UPC-A in one database and its EAN-13 elsewhere.
    const canonical = toGtin14(barcode);
    if (!canonical) return null;
    const shard = await loadShard(shardKey(canonical));
    if (!shard) return null;
    const match = shard.find((tuple) => tuple[0] === canonical);
    return match ? tupleToOpenFoodFactsProduct(match) : null;
  } catch {
    return null;
  }
}
