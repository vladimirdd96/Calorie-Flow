/**
 * Seeds `public.product_catalogue` from the Open Food Facts JSONL export.
 *
 * The export is ~12 GB gzipped, so it is streamed and filtered in flight and never
 * written to disk. Only rows that pass the country/brand filter and carry usable
 * per-100 nutrition are kept, which is what holds the seed inside Supabase Free's
 * 500 MB database limit while still covering the supermarket private labels that make
 * barcode scans fail today.
 *
 * Open Food Facts data is ODbL. Each row keeps `source = 'open-food-facts'` and its
 * upstream code in `source_ref` so the attribution and share-alike terms are satisfied.
 *
 * Usage:
 *   node scripts/catalogue/import-open-food-facts.mjs [options]
 *
 *   --countries=en:bulgaria,en:romania   Country tags to import wholesale
 *   --brands=pilos,k-classic             Override the bundled house-brand list
 *   --all-brands                         Keep every brand (ignore the brand filter)
 *   --source=<path|url>                  Read a local .jsonl.gz instead of downloading
 *   --limit=5000                         Stop after N matching products
 *   --dry-run                            Filter and report without writing to Supabase
 */
import { houseBrandTags, defaultCountryTags } from "./brands.mjs";
import { supabaseFetch } from "../lib/supabase-rest.mjs";
import { getAccessToken } from "../lib/supabase-auth.mjs";
import { DUMP_URL, readDump } from "./dump.mjs";
import { normalizeProduct } from "./product.mjs";
// Small batches on purpose: matches are sparse and spread across a 12 GB stream, so a
// large buffer means a long run can die holding hundreds of unwritten rows. Re-running
// is idempotent but re-downloads everything, which is the cost worth avoiding.
const BATCH_SIZE = 200;

function parseArgs(argv) {
  const options = { dryRun: false, allBrands: false, limit: Infinity, source: DUMP_URL };
  for (const argument of argv) {
    const [key, value = ""] = argument.replace(/^--/, "").split("=");
    if (key === "dry-run") options.dryRun = true;
    else if (key === "all-brands") options.allBrands = true;
    else if (key === "limit") options.limit = Number.parseInt(value, 10) || Infinity;
    else if (key === "source") options.source = value;
    else if (key === "countries") options.countries = value.split(",").map((tag) => tag.trim()).filter(Boolean);
    else if (key === "brands") options.brands = value.split(",").map((tag) => tag.trim()).filter(Boolean);
    else throw new Error(`Unknown option --${key}`);
  }
  options.countries = new Set(options.countries?.length ? options.countries : defaultCountryTags);
  options.brands = new Set(options.brands?.length ? options.brands : houseBrandTags);
  return options;
}

function toRow(record, contributedBy) {
  const product = normalizeProduct(record);
  if (!product) return null;
  return {
    barcode: product.code,
    name: product.name.slice(0, 240),
    brand: product.brand,
    quantity_label: product.quantityLabel,
    serving_label: product.servingLabel,
    serving_grams: product.servingGrams,
    package_grams: product.packageGrams,
    image_url: product.imageUrl && product.imageUrl.length <= 600 ? product.imageUrl : null,
    nutrients_per_100: product.nutrition,
    keywords: product.keywords,
    source: "open-food-facts",
    source_ref: product.code,
    countries: product.countriesTags.slice(0, 12),
    // Only published composition data earns `verified`; Open Food Facts rows are
    // crowd-entered from packaging, which is exactly what "unverified" is for.
    verified: false,
    contributed_by: contributedBy,
  };
}

function matches(product, options) {
  const brandTags = Array.isArray(product.brands_tags) ? product.brands_tags : [];
  if (!options.allBrands && brandTags.some((tag) => options.brands.has(tag))) return true;
  const countryTags = Array.isArray(product.countries_tags) ? product.countries_tags : [];
  return countryTags.some((tag) => options.countries.has(tag));
}

/**
 * The insert policy requires `contributed_by = auth.uid()`, so a run authenticated as a
 * user has to stamp that user's id. A service-role key bypasses RLS entirely and leaves
 * seeded rows owner-less, which is what we want: nobody should be able to edit them
 * through the app.
 */
async function resolveContributor() {
  const token = await getAccessToken();
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return payload.role === "service_role" ? null : payload.sub || null;
  } catch {
    return null;
  }
}

async function writeBatch(rows, options) {
  if (options.dryRun || !rows.length) return rows.length;
  // ignore-duplicates, never merge: a barcode already in the table was answered by a
  // user holding the actual package, and that beats a crowd-sourced export row.
  const response = await supabaseFetch("/product_catalogue", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(`Batch insert failed: ${response.status} ${await response.text()}`);
  return rows.length;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const contributedBy = options.dryRun ? null : await resolveContributor();
  console.log(`Streaming ${options.source}`);
  console.log(`Countries: ${[...options.countries].join(", ") || "(none)"}`);
  console.log(`Brands: ${options.allBrands ? "(all)" : `${options.brands.size} house labels`}`);
  if (options.dryRun) console.log("Dry run — nothing will be written.");

  let scanned = 0;
  let matched = 0;
  let written = 0;
  let batch = [];

  for await (const product of readDump(options.source)) {
    scanned += 1;
    if (scanned % 250_000 === 0) console.log(`  scanned ${scanned.toLocaleString()} · matched ${matched.toLocaleString()} · written ${written.toLocaleString()}`);
    if (!matches(product, options)) continue;
    const row = toRow(product, contributedBy);
    if (!row) continue;
    // A dry run is for checking the filter and the mapping, so show what it would write.
    if (options.dryRun && matched < 3) console.log(JSON.stringify(row, null, 2));
    matched += 1;
    batch.push(row);
    if (batch.length >= BATCH_SIZE) {
      written += await writeBatch(batch, options);
      batch = [];
      console.log(`  wrote ${written.toLocaleString()} products (scanned ${scanned.toLocaleString()})`);
    }
    if (matched >= options.limit) break;
  }
  written += await writeBatch(batch, options);

  console.log(`Done. Scanned ${scanned.toLocaleString()} products, kept ${matched.toLocaleString()}, wrote ${written.toLocaleString()}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
