import { readFileSync, readdirSync, appendFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { getAccessToken, supabaseRestUrl, publishableKey } from "./auth.mjs";
import { enrichEntry } from "./enrich.mjs";

const dataDir = new URL("./data/", import.meta.url);
const failuresPath = new URL("./update-failures.jsonl", import.meta.url);

function searchKey(name) {
  return name.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

async function supabaseFetch(path, init, { retry = true } = {}) {
  const token = await getAccessToken();
  const response = await fetch(`${supabaseRestUrl}${path}`, {
    ...init,
    headers: { ...init.headers, apikey: publishableKey, Authorization: `Bearer ${token}` },
  });
  if (response.status === 401 && retry) {
    await getAccessToken({ forceRefresh: true });
    return supabaseFetch(path, init, { retry: false });
  }
  return response;
}

function logFailure(entry, error) {
  appendFileSync(failuresPath, JSON.stringify({ name: entry.name, error: String(error), at: new Date().toISOString() }) + "\n");
}

async function updateRecipe(entry, cuisine) {
  const enriched = enrichEntry(entry);
  const key = searchKey(entry.name);
  const body = {
    ingredients: enriched.ingredients.map((i) => ({ id: randomUUID(), name: i.name, quantity: i.quantity })),
    instructions: enriched.instructions,
    dietary_tags: enriched.dietaryTags,
    cuisine,
  };
  const response = await supabaseFetch(`/public_recipes?search_key=eq.${encodeURIComponent(key)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
}

const cuisineByFile = {
  "alex-snodgrass.json": "american",
  "alex-snodgrass-2.json": "american",
  "alex-snodgrass-3.json": "american",
  "recipetin-eats.json": "australian",
  "recipetin-eats-2.json": "australian",
};

async function main() {
  const files = readdirSync(dataDir).filter((f) => f.endsWith(".json"));
  let updated = 0, failed = 0;
  for (const file of files) {
    const cuisine = cuisineByFile[file];
    if (!cuisine) { console.log(`Skipping ${file}: no cuisine mapping`); continue; }
    const entries = JSON.parse(readFileSync(new URL(file, dataDir), "utf8"));
    console.log(`\n${file}: ${entries.length} entries (cuisine=${cuisine})`);
    for (const entry of entries) {
      try {
        await updateRecipe(entry, cuisine);
        updated++;
        process.stdout.write(".");
      } catch (error) {
        failed++;
        logFailure(entry, error);
        process.stdout.write("x");
      }
    }
  }
  console.log(`\n\nDone. updated=${updated} failed=${failed}`);
  if (failed > 0) console.log("See scripts/seed-recipes/update-failures.jsonl for details.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
