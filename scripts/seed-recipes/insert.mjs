import { readFileSync, readdirSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { getAccessToken, supabaseRestUrl, publishableKey } from "./auth.mjs";

const dataDir = new URL("./data/", import.meta.url);
const failuresPath = new URL("./failures.jsonl", import.meta.url);

function searchKey(name) {
  return name.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

async function supabaseFetch(path, init, { retry = true } = {}) {
  const token = await getAccessToken();
  const response = await fetch(`${supabaseRestUrl}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
    },
  });
  if (response.status === 401 && retry) {
    await getAccessToken({ forceRefresh: true });
    return supabaseFetch(path, init, { retry: false });
  }
  return response;
}

async function loadExistingSearchKeys() {
  const keys = new Set();
  let offset = 0;
  const pageSize = 1000;
  for (;;) {
    const response = await supabaseFetch(
      `/public_recipes?select=search_key&limit=${pageSize}&offset=${offset}`,
      { headers: {} },
    );
    if (!response.ok) throw new Error(`Failed to load existing search_keys: ${response.status} ${await response.text()}`);
    const rows = await response.json();
    for (const row of rows) keys.add(row.search_key);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return keys;
}

function logFailure(entry, error) {
  appendFileSync(failuresPath, JSON.stringify({ name: entry.name, error: String(error), at: new Date().toISOString() }) + "\n");
}

async function insertRecipe(entry) {
  const body = {
    name: entry.name,
    servings: entry.servings,
    serving_grams: entry.servingGrams,
    ingredients: entry.ingredients.map((name) => ({ id: randomUUID(), name })),
    nutrition_per_serving: entry.nutritionPerServing,
    image_url: entry.imageUrl,
    image_credit: entry.imageUrl && entry.imageCredit ? entry.imageCredit : undefined,
    source: "ai",
  };
  const response = await supabaseFetch("/public_recipes", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  if (response.status === 409) return "duplicate";
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return "inserted";
}

async function main() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const files = readdirSync(dataDir).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.log("No data files found in scripts/seed-recipes/data/.");
    return;
  }

  console.log("Loading existing search_key set from Supabase...");
  const existing = await loadExistingSearchKeys();
  console.log(`${existing.size} recipes already in public_recipes.`);

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const entries = JSON.parse(readFileSync(new URL(file, dataDir), "utf8"));
    console.log(`\n${file}: ${entries.length} entries`);
    for (const entry of entries) {
      const key = searchKey(entry.name);
      if (existing.has(key)) {
        skipped++;
        continue;
      }
      try {
        const result = await insertRecipe(entry);
        existing.add(key);
        if (result === "inserted") {
          inserted++;
          process.stdout.write(".");
        } else {
          skipped++;
          process.stdout.write("d");
        }
      } catch (error) {
        failed++;
        logFailure(entry, error);
        process.stdout.write("x");
      }
    }
  }

  console.log(`\n\nDone. inserted=${inserted} skipped=${skipped} failed=${failed}`);
  if (failed > 0) console.log(`See scripts/seed-recipes/failures.jsonl for details.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
