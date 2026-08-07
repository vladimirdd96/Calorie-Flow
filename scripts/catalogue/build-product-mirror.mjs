/**
 * Builds the product mirror from the Open Food Facts JSONL export.
 *
 * The Supabase catalogue holds what users resolve themselves; it is small, mutable and
 * bounded by a 500 MB free tier. This mirror is the opposite: the whole Open Food Facts
 * dataset, immutable, shipped as Worker static assets and read straight from the `ASSETS`
 * binding. That destination was chosen because it needs no new service, no separate
 * account and no payment method — the free plan allows 20,000 files per Worker version at
 * 25 MiB each, and 4,096 shards of roughly 60 KB sit comfortably inside both limits.
 *
 * The point is reliability as much as coverage: answering a barcode from an asset means a
 * scan still works while the Open Food Facts API is down, which it measurably is.
 *
 * Products are bucketed by a hash of their canonical GTIN-14 so a lookup reads exactly one
 * shard. See scripts/catalogue/shard.mjs for the layout src/lib/product-mirror.ts mirrors.
 *
 * Usage:
 *   node scripts/catalogue/build-product-mirror.mjs [options]
 *
 *   --out=<dir>           Where to write shards (default: ./.product-mirror)
 *   --source=<path|url>   Read a local .jsonl.gz instead of downloading the export
 *   --limit=50000         Stop after N products (for a rehearsal)
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { SHARD_COUNT, shardIndex } from "./shard.mjs";
import { DUMP_URL, readDump } from "./dump.mjs";
import { normalizeProduct } from "./product.mjs";
/** Flush buffered shard lines once this many products are held in memory. */
const FLUSH_EVERY = 200_000;

function parseArgs(argv) {
  const options = { out: "./.product-mirror", limit: Infinity, source: DUMP_URL };
  for (const argument of argv) {
    const [key, value = ""] = argument.replace(/^--/, "").split("=");
    if (key === "out") options.out = value;
    else if (key === "source") options.source = value;
    else if (key === "limit") options.limit = Number.parseInt(value, 10) || Infinity;
    else throw new Error(`Unknown option --${key}`);
  }
  return options;
}

function toGtin14(code) {
  const digits = String(code || "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 14 ? digits.padStart(14, "0") : "";
}

/**
 * Positional tuple; see PRODUCT_FIELDS in shard.mjs. Objects would repeat the same twelve
 * keys three million times, which costs more than the values themselves. Micronutrients
 * are deliberately left out: they roughly double the payload, and the live providers still
 * supply them whenever they are reachable.
 */
function toTuple(record) {
  const product = normalizeProduct(record);
  if (!product) return null;
  const gtin14 = toGtin14(product.code);
  if (!gtin14) return null;
  const { calories, protein, carbs, fat, fiber, sugar } = product.nutrition;
  return [
    gtin14, product.name.slice(0, 200), product.brand ? product.brand.slice(0, 80) : null,
    calories, protein, carbs, fat, fiber, sugar,
    product.servingGrams, product.packageGrams, product.imageUrl,
  ];
}

function shardPath(directory, index) {
  return join(directory, `${index.toString(16).padStart(3, "0")}.ndjson`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const staging = join(options.out, "staging");
  rmSync(options.out, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });

  console.log(`Streaming ${options.source}`);
  const buffers = new Map();
  let buffered = 0;
  let scanned = 0;
  let kept = 0;

  const flush = () => {
    for (const [index, entries] of buffers) appendFileSync(shardPath(staging, index), entries.join("\n") + "\n");
    buffers.clear();
    buffered = 0;
  };

  for await (const product of readDump(options.source)) {
    scanned += 1;
    if (scanned % 500_000 === 0) console.log(`  scanned ${scanned.toLocaleString()} · kept ${kept.toLocaleString()}`);
    const tuple = toTuple(product);
    if (!tuple) continue;
    const index = shardIndex(tuple[0]);
    const entries = buffers.get(index) || [];
    entries.push(JSON.stringify(tuple));
    buffers.set(index, entries);
    kept += 1;
    buffered += 1;
    if (buffered >= FLUSH_EVERY) flush();
    if (kept >= options.limit) break;
  }
  flush();

  console.log(`Compacting ${SHARD_COUNT} shards…`);
  let bytes = 0;
  let written = 0;
  for (let index = 0; index < SHARD_COUNT; index += 1) {
    const path = shardPath(staging, index);
    if (!existsSync(path)) continue;
    const tuples = readFileSync(path, "utf8").split("\n").filter(Boolean).map((entry) => JSON.parse(entry));
    const payload = gzipSync(Buffer.from(JSON.stringify(tuples)), { level: 9 });
    writeFileSync(join(options.out, `${index.toString(16).padStart(3, "0")}.json.gz`), payload);
    bytes += payload.length;
    written += 1;
  }
  rmSync(staging, { recursive: true, force: true });
  console.log(`Built ${written} shards, ${(bytes / 1e9).toFixed(2)} GB total, from ${kept.toLocaleString()} products.`);

  console.log(`Copy them into the deploy with: npm run mirror:stage`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
