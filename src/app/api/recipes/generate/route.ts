import { NextRequest, NextResponse } from "next/server";
import { authenticatePaidFeature } from "@/lib/server-auth";
import { generatedRecipeSchema, publicRecipeSchema } from "@/lib/schemas";
import { getWorkersAi, workersAiModels } from "@/lib/workers-ai";
import { extractOutputText, parseJsonObject } from "@/lib/workers-ai-text";
import { supabaseRest } from "@/lib/supabase-rest";
import { recipeSearchKey } from "@/lib/planning";
import { serverEnv } from "@/lib/env";
import type { PublicRecipe } from "@/lib/types";

export const runtime = "nodejs";

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const BATCH_TARGET = 6;
const FALLBACK_DISHES = ["Weeknight vegetable stir-fry", "Baked chicken and rice", "Lentil and spinach soup", "Grilled salmon with greens", "Chickpea and tomato stew", "Turkey and vegetable chili", "Egg and vegetable scramble", "Beef and broccoli bowl"];

type SearchCandidate = { title: string; description: string; pageUrl: string; imageUrl?: string; siteName?: string };

function isRecipeSearchConfigured() {
  return Boolean(serverEnv.TAVILY_API_KEY);
}

async function tavilySearch(query: string): Promise<SearchCandidate[]> {
  const key = serverEnv.TAVILY_API_KEY;
  if (!key) return [];
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ query, max_results: 8 }),
      cache: "no-store",
    });
    if (!response.ok) return [];
    const body = await response.json() as { results?: Array<{ title?: string; content?: string; url?: string }> };
    const results = body.results || [];
    return results
      .filter((result): result is { title: string; content: string; url: string } => Boolean(result.title && result.url))
      .map((result) => ({ title: result.title, description: result.content || "", pageUrl: result.url }));
  } catch {
    return [];
  }
}

/** Best-effort og:image/og:site_name lookup, reading only the head of the page. Never throws. */
async function enrichWithPageMeta(candidate: SearchCandidate): Promise<SearchCandidate> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(candidate.pageUrl, { signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; CalorieFlowRecipeBot/1.0)" } });
    clearTimeout(timeout);
    if (!response.ok || !response.body) return candidate;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let html = "";
    while (html.length < 60_000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
    await reader.cancel().catch(() => undefined);
    const imageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    const siteMatch = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);
    const imageUrl = imageMatch?.[1];
    return {
      ...candidate,
      imageUrl: imageUrl && /^https:\/\//i.test(imageUrl) ? imageUrl : undefined,
      siteName: siteMatch?.[1] || new URL(candidate.pageUrl).hostname.replace(/^www\./, ""),
    };
  } catch {
    return candidate;
  }
}

async function rewriteAsRecipe(ai: Awaited<ReturnType<typeof getWorkersAi>>, inspiration: string) {
  const responseSchema = {
    type: "object", additionalProperties: false,
    properties: {
      name: { type: "string" }, servings: { type: "number" }, servingGrams: { type: "number" },
      ingredients: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 20 },
      nutritionPerServing: { type: "object", additionalProperties: false, properties: { calories: { type: "number" }, protein: { type: "number" }, carbs: { type: "number" }, fat: { type: "number" }, fiber: { type: "number" }, sugar: { type: "number" } }, required: ["calories", "protein", "carbs", "fat", "fiber", "sugar"] },
    },
    required: ["name", "servings", "servingGrams", "ingredients", "nutritionPerServing"],
  };
  const request = {
    messages: [
      { role: "system", content: "Write an original home-cook recipe inspired by a dish concept. Never copy sentences from any source you're given — write your own ingredient list and name in your own words, thinking about what that dish typically contains. Return realistic servings, grams per serving, and an estimated nutritionPerServing." },
      { role: "user", content: `Dish concept: ${inspiration}\n\nReturn a structured recipe.` },
    ],
    response_format: { type: "json_schema", json_schema: { name: "generated_recipe", strict: true, schema: responseSchema } },
    chat_template_kwargs: { thinking: false },
    max_completion_tokens: 500,
    temperature: 0.4,
  };
  let text = "";
  try { text = extractOutputText(await ai.run(workersAiModels.coach, request)) || ""; } catch { /* fall through to relaxed schema */ }
  let parsed = text ? generatedRecipeSchema.safeParse(parseJsonObject(text)) : { success: false } as const;
  if (!parsed.success) {
    try { text = extractOutputText(await ai.run(workersAiModels.coach, { ...request, response_format: { type: "json_object" } })) || ""; } catch { text = ""; }
    parsed = text ? generatedRecipeSchema.safeParse(parseJsonObject(text)) : { success: false } as const;
  }
  return parsed.success ? parsed.data : undefined;
}

async function existingBySearchKey(token: string, searchKey: string): Promise<PublicRecipe | undefined> {
  const response = await supabaseRest(`public_recipes?select=${encodeURIComponent(publicRecipeRestColumns)}&search_key=eq.${encodeURIComponent(searchKey)}&limit=1`, token);
  if (!response.ok) return undefined;
  const rows = await response.json() as unknown[];
  const row = rows[0];
  return row ? rowToPublicRecipe(row as Record<string, unknown>) : undefined;
}

const publicRecipeRestColumns = "id,name,servings,serving_grams,ingredients,nutrition_per_serving,image_url,image_credit,source,author_id,created_at";

function rowToPublicRecipe(row: Record<string, unknown>): PublicRecipe {
  return publicRecipeSchema.parse({
    id: row.id, name: row.name, servings: row.servings, servingGrams: row.serving_grams,
    ingredients: row.ingredients, nutritionPerServing: row.nutrition_per_serving,
    imageUrl: row.image_url || undefined, imageCredit: row.image_credit || undefined,
    source: row.source, authorId: row.author_id || undefined, createdAt: row.created_at,
  });
}

function isTopFoodsList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 8 && value.every((item) => typeof item === "string" && item.trim().length > 0 && item.length <= 120);
}

export async function POST(request: NextRequest) {
  const auth = await authenticatePaidFeature(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({})) as { topFoods?: unknown };
  const topFoods = isTopFoodsList(body.topFoods) ? body.topFoods : [];

  try {
    const cooldownResponse = await supabaseRest("recipe_generation_log?select=generated_at", auth.token);
    if (cooldownResponse.ok) {
      const rows = await cooldownResponse.json() as Array<{ generated_at?: string }>;
      const lastRun = rows[0]?.generated_at ? new Date(rows[0].generated_at).getTime() : 0;
      const elapsed = Date.now() - lastRun;
      if (lastRun && elapsed < COOLDOWN_MS) {
        return NextResponse.json({ error: "You can refresh your picks once every 7 days.", retryAfterSeconds: Math.ceil((COOLDOWN_MS - elapsed) / 1000) }, { status: 429 });
      }
    }

    const ai = await getWorkersAi();
    const searchConfigured = isRecipeSearchConfigured();
    const query = topFoods.length ? `${topFoods.slice(0, 3).join(" ")} recipe` : "healthy home-cooked recipe";
    const searchResults = searchConfigured ? await tavilySearch(query) : [];
    const enriched = await Promise.all(searchResults.slice(0, 10).map(enrichWithPageMeta));

    const surfaced: PublicRecipe[] = [];
    let inserted = 0;

    const candidates = enriched.length
      ? enriched.map((candidate) => ({ inspiration: `${candidate.title} — ${candidate.description}`.trim(), source: candidate }))
      : (topFoods.length ? topFoods.map((food) => `A recipe featuring ${food}`) : FALLBACK_DISHES).map((inspiration) => ({ inspiration, source: undefined as SearchCandidate | undefined }));

    for (const candidate of candidates) {
      if (inserted >= BATCH_TARGET) break;
      const generated = await rewriteAsRecipe(ai, candidate.inspiration);
      if (!generated) continue;
      const searchKey = recipeSearchKey(generated.name);
      const existing = await existingBySearchKey(auth.token, searchKey);
      if (existing) {
        if (surfaced.length < BATCH_TARGET && !surfaced.some((item) => item.id === existing.id)) surfaced.push(existing);
        continue;
      }
      const insertResponse = await supabaseRest("public_recipes", auth.token, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          name: generated.name,
          servings: generated.servings,
          serving_grams: generated.servingGrams,
          ingredients: generated.ingredients.map((name) => ({ id: crypto.randomUUID(), name })),
          nutrition_per_serving: generated.nutritionPerServing,
          image_url: candidate.source?.imageUrl,
          image_credit: candidate.source?.imageUrl ? { label: candidate.source.siteName, sourceUrl: candidate.source.pageUrl } : undefined,
          source: "ai",
        }),
      });
      if (insertResponse.ok) {
        const rows = await insertResponse.json() as unknown[];
        const row = rows[0];
        if (row) { surfaced.push(rowToPublicRecipe(row as Record<string, unknown>)); inserted += 1; }
      } else if (insertResponse.status === 409) {
        const raceWinner = await existingBySearchKey(auth.token, searchKey);
        if (raceWinner && !surfaced.some((item) => item.id === raceWinner.id)) surfaced.push(raceWinner);
      }
    }

    await supabaseRest("recipe_generation_log", auth.token, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: auth.userId, generated_at: new Date().toISOString() }),
    });

    return NextResponse.json({ recipes: surfaced });
  } catch {
    return NextResponse.json({ error: "Couldn't refresh your picks right now. Try again later." }, { status: 500 });
  }
}
