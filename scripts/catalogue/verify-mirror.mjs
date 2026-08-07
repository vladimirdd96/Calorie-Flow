/**
 * Verifies a built product mirror before it is staged into a deploy.
 *
 * This exists because a truncated build passed every casual check: the right number of
 * shards, zero hash misplacements, a plausible total size — and was missing a quarter of
 * the dataset. Totals cannot detect absence. Only naming specific products that must be
 * present, and sampling the mirror against the live API, can.
 *
 * Usage:
 *   node scripts/catalogue/verify-mirror.mjs [--dir=./.product-mirror] [--sample=40] [--offline]
 *
 *   --sample=N   Cross-check N random mirrored products against the Open Food Facts API
 *   --offline    Skip the API cross-check (structure and known barcodes only)
 */
import { gunzipSync } from "node:zlib";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { shardIndex } from "./shard.mjs";

/**
 * Products that must exist in any complete mirror. Deliberately spread across GS1
 * prefixes and shard buckets: a global staple, the Bulgarian and German private labels
 * this catalogue exists to cover, and a retailer in-store EAN-8.
 */
const REQUIRED = [
  ["5449000000996", "Coca-Cola 330 ml"],
  ["4056489814795", "Pilos High Protein Quark"],
  ["4056489358770", "Pilos butter 82%"],
  ["20961800", "Lidl in-store EAN-8 yogurt"],
  ["3017620422003", "Nutella 400 g"],
  ["5000159407236", "Mars bar"],
];

function parseArgs(argv) {
  const options = { dir: "./.product-mirror", sample: 40, offline: false };
  for (const argument of argv) {
    const [key, value = ""] = argument.replace(/^--/, "").split("=");
    if (key === "offline") options.offline = true;
    else if (key === "dir") options.dir = value;
    else if (key === "sample") options.sample = Number.parseInt(value, 10) || 0;
    else throw new Error(`Unknown option --${key}`);
  }
  return options;
}

function toGtin14(code) {
  const digits = String(code || "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 14 ? digits.padStart(14, "0") : "";
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!existsSync(options.dir)) throw new Error(`No mirror at ${options.dir}. Run npm run mirror:build first.`);
  const files = readdirSync(options.dir).filter((name) => name.endsWith(".json.gz"));
  if (!files.length) throw new Error(`No shards in ${options.dir}.`);

  const wanted = new Map(REQUIRED.map(([code, label]) => [toGtin14(code), label]));
  const found = new Map();
  const everything = [];
  let total = 0;
  let misplaced = 0;
  let largest = 0;

  for (const file of files) {
    const expected = Number.parseInt(file.slice(0, 3), 16);
    const bytes = readFileSync(join(options.dir, file));
    largest = Math.max(largest, bytes.length);
    const shard = JSON.parse(gunzipSync(bytes).toString());
    total += shard.length;
    for (const tuple of shard) {
      if (shardIndex(tuple[0]) !== expected) misplaced += 1;
      if (wanted.has(tuple[0])) found.set(tuple[0], tuple);
      everything.push(tuple);
    }
  }

  const problems = [];
  console.log(`shards:            ${files.length}`);
  console.log(`products:          ${total.toLocaleString()}`);
  console.log(`largest shard:     ${(largest / 1024).toFixed(1)} KB (limit 25 MiB)`);
  console.log(`misplaced:         ${misplaced}`);
  if (misplaced) problems.push(`${misplaced} products are in the wrong shard — the builder and Worker hashes have diverged.`);
  if (files.length > 20_000) problems.push(`${files.length} shards exceeds the 20,000-file free-plan limit.`);

  console.log("\nrequired products:");
  for (const [canonical, label] of wanted) {
    const tuple = found.get(canonical);
    console.log(`  ${tuple ? "ok     " : "MISSING"} ${canonical}  ${label}${tuple ? ` — ${tuple[1]}` : ""}`);
    if (!tuple) problems.push(`${label} (${canonical}) is absent — the export was probably truncated.`);
  }

  if (!options.offline && options.sample > 0) {
    console.log(`\ncross-checking ${options.sample} random products against the live API…`);
    let checked = 0;
    let agreed = 0;
    let unreachable = 0;
    for (let attempt = 0; attempt < options.sample; attempt += 1) {
      const tuple = everything[Math.floor(Math.random() * everything.length)];
      const code = tuple[0].replace(/^0+(?=\d{8})/, "");
      try {
        const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=code,nutriments`, {
          headers: { "User-Agent": "Calorie Flow/1.0 (catalogue-verify)" },
        });
        if (!response.ok) { unreachable += 1; continue; }
        const payload = await response.json();
        if (payload?.status !== 1) { unreachable += 1; continue; }
        checked += 1;
        const upstream = Math.round(Number(payload.product?.nutriments?.["energy-kcal_100g"]) || 0);
        // Upstream moves; a mismatch means stale, not broken. Only a systematic gap matters.
        if (Math.abs(upstream - tuple[3]) <= 1) agreed += 1;
      } catch {
        unreachable += 1;
      }
    }
    console.log(`  ${agreed}/${checked} agreed on energy (${unreachable} unreachable)`);
    if (checked >= 10 && agreed / checked < 0.8) problems.push(`only ${agreed}/${checked} sampled products matched upstream energy — the mapping may be wrong.`);
  }

  if (problems.length) {
    console.error(`\nFAILED:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`);
    process.exitCode = 1;
    return;
  }
  console.log("\nMirror looks complete.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
