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
import { createGunzip } from "node:zlib";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { houseBrandTags, defaultCountryTags } from "./brands.mjs";
import { supabaseFetch } from "../lib/supabase-rest.mjs";
import { getAccessToken } from "../lib/supabase-auth.mjs";

const DUMP_URL = "https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz";
const BATCH_SIZE = 500;
const BARCODE = /^[0-9]{8,14}$/;

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

function numberValue(value) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function positive(value) {
  const parsed = numberValue(value);
  return parsed > 0 ? parsed : null;
}

/** Mirrors `mapNutrition` in src/lib/openfoodfacts.ts so seeded rows match live lookups. */
function mapNutrition(nutriments) {
  const micronutrients = {
    sodiumMg: numberValue(nutriments.sodium_100g) * 1000,
    cholesterolMg: numberValue(nutriments.cholesterol_100g),
    saturatedFatG: numberValue(nutriments["saturated-fat_100g"]),
    potassiumMg: numberValue(nutriments.potassium_100g),
    calciumMg: numberValue(nutriments.calcium_100g),
    ironMg: numberValue(nutriments.iron_100g),
    magnesiumMg: numberValue(nutriments.magnesium_100g),
    zincMg: numberValue(nutriments.zinc_100g),
    vitaminAMcg: numberValue(nutriments["vitamin-a_100g"]),
    vitaminCMg: numberValue(nutriments["vitamin-c_100g"]),
    vitaminDMcg: numberValue(nutriments["vitamin-d_100g"]),
    vitaminEMg: numberValue(nutriments["vitamin-e_100g"]),
    vitaminKMcg: numberValue(nutriments["vitamin-k_100g"]),
    vitaminB12Mcg: numberValue(nutriments["vitamin-b12_100g"]),
    folateMcg: numberValue(nutriments.folates_100g),
  };
  const kilocalories = numberValue(nutriments["energy-kcal_100g"]);
  const kilojoules = numberValue(nutriments.energy_100g);
  const nutrition = {
    calories: Math.round(kilocalories || kilojoules / 4.184 || 0),
    protein: numberValue(nutriments.proteins_100g),
    carbs: numberValue(nutriments.carbohydrates_100g),
    fat: numberValue(nutriments.fat_100g),
    fiber: numberValue(nutriments.fiber_100g),
    sugar: numberValue(nutriments.sugars_100g),
  };
  if (Object.values(micronutrients).some(Boolean)) nutrition.micronutrients = micronutrients;
  return nutrition;
}

/** Local-language names Open Food Facts stores per language, kept as hidden search terms. */
function collectKeywords(product, name) {
  const terms = new Set();
  for (const [key, value] of Object.entries(product)) {
    if (!key.startsWith("product_name_") && !key.startsWith("generic_name_")) continue;
    if (typeof value !== "string") continue;
    const term = value.trim();
    if (term && term !== name && term.length <= 120) terms.add(term);
  }
  return [...terms].slice(0, 20);
}

function matches(product, options) {
  const brandTags = Array.isArray(product.brands_tags) ? product.brands_tags : [];
  if (!options.allBrands && brandTags.some((tag) => options.brands.has(tag))) return true;
  const countryTags = Array.isArray(product.countries_tags) ? product.countries_tags : [];
  return countryTags.some((tag) => options.countries.has(tag));
}

function toRow(product, contributedBy) {
  const barcode = String(product.code || "").trim();
  if (!BARCODE.test(barcode)) return null;
  const name = (product.product_name || product.generic_name || "").trim();
  if (!name || name.length > 240) return null;
  const nutriments = product.nutriments;
  if (!nutriments || typeof nutriments !== "object") return null;
  const nutrition = mapNutrition(nutriments);
  // A row with neither energy nor macros cannot answer "how much did I eat".
  if (!nutrition.calories && !nutrition.protein && !nutrition.carbs && !nutrition.fat) return null;

  const image = product.image_front_small_url || product.image_small_url || product.image_front_url;
  return {
    barcode,
    name,
    brand: (product.brands || "").split(",")[0]?.trim().slice(0, 120) || null,
    quantity_label: (product.quantity || "").trim().slice(0, 60) || null,
    serving_label: (product.serving_size || "").trim().slice(0, 60) || null,
    serving_grams: positive(product.serving_quantity),
    package_grams: positive(product.product_quantity),
    image_url: typeof image === "string" && image.startsWith("https://") && image.length <= 600 ? image : null,
    nutrients_per_100: nutrition,
    keywords: collectKeywords(product, name),
    source: "open-food-facts",
    source_ref: barcode,
    countries: Array.isArray(product.countries_tags) ? product.countries_tags.slice(0, 12) : [],
    // Only published composition data earns `verified`; Open Food Facts rows are
    // crowd-entered from packaging, which is exactly what "unverified" is for.
    verified: false,
    contributed_by: contributedBy,
  };
}

async function openDump(source) {
  if (!/^https?:\/\//.test(source)) return createReadStream(source).pipe(createGunzip());
  const response = await fetch(source, { headers: { "User-Agent": "Calorie Flow/1.0 (catalogue-seed)" } });
  if (!response.ok || !response.body) throw new Error(`Could not download the Open Food Facts export: ${response.status}`);
  return Readable.fromWeb(response.body).pipe(createGunzip());
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

  const lines = createInterface({ input: await openDump(options.source), crlfDelay: Infinity });
  let scanned = 0;
  let matched = 0;
  let written = 0;
  let batch = [];

  for await (const line of lines) {
    if (!line) continue;
    scanned += 1;
    if (scanned % 250_000 === 0) console.log(`  scanned ${scanned.toLocaleString()} · matched ${matched.toLocaleString()} · written ${written.toLocaleString()}`);
    let product;
    try { product = JSON.parse(line); } catch { continue; }
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
