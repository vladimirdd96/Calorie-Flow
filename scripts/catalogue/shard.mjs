/**
 * Shard layout for the R2 product mirror, shared by the builder and the Worker.
 *
 * Sharding by barcode prefix would be badly unbalanced — GS1 prefixes cluster by country
 * and company, so `380*` (Bulgaria) and `40*` (Germany) would dwarf everything else. A
 * hash spreads products evenly instead, which keeps every shard small enough to fetch and
 * parse inside a single Worker request.
 */

/** 4096 shards over ~4M products is roughly 1000 products and ~80 KB gzipped each. */
export const SHARD_COUNT = 4096;

/** FNV-1a: tiny, dependency-free, and stable across the builder and the Worker. */
export function shardIndex(gtin14) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < gtin14.length; index += 1) {
    hash ^= gtin14.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % SHARD_COUNT;
}

export function shardKey(gtin14) {
  return `p/${shardIndex(gtin14).toString(16).padStart(3, "0")}.json`;
}

/**
 * Products are stored as positional tuples rather than objects: at four million rows the
 * repeated JSON keys would cost more than the values do.
 */
export const PRODUCT_FIELDS = [
  "gtin14", "name", "brand", "calories", "protein", "carbs", "fat", "fiber", "sugar",
  "servingGrams", "packageGrams", "imageUrl",
];

export function tupleToProduct(tuple) {
  const product = {};
  PRODUCT_FIELDS.forEach((field, index) => { product[field] = tuple[index] ?? null; });
  return product;
}
