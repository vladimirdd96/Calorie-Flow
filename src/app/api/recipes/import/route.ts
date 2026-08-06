import { NextRequest, NextResponse } from "next/server";
import { authenticatePaidFeature } from "@/lib/server-auth";
import { supabaseRest } from "@/lib/supabase-rest";
import { getWorkersAi, workersAiModels, type WorkersAi } from "@/lib/workers-ai";
import { extractOutputText, parseJsonObject } from "@/lib/workers-ai-text";
import { estimateRecipeNutrition, isEstimatableRecipe } from "@/lib/recipe-nutrition";
import { importedRecipeSchema, recipeImportExtractions, recipeImportNutritionSources, recipeImportRequestSchema, recipeImportResultSchema } from "@/lib/schemas";
import { extractMetaTags, htmlToText, siteNameFromUrl } from "@/lib/recipe-import/html";
import { extractJsonLdBlocks, findRecipeNode, parseSchemaRecipe, type ParsedNutrition, type ParsedRecipe } from "@/lib/recipe-import/schema-org";
import { parseMicrodataRecipe } from "@/lib/recipe-import/microdata";
import { splitIngredientLines } from "@/lib/recipe-import/ingredients";
import { dietaryTagsFor } from "@/lib/recipe-import/dietary";
import { safeFetchPage, type PageFetchFailure } from "@/lib/recipe-import/fetch";
import { cuisines } from "@/lib/types";
import type { Nutrition } from "@/lib/types";

export const runtime = "nodejs";

/** Bounds the arbitrary-URL fetch surface without rationing an everyday action. */
const IMPORT_WINDOW_MS = 60 * 60 * 1000;
const IMPORT_LIMIT = 20;
/** Editable starting points when a page states neither — a home-cooked main dish. */
const DEFAULT_SERVINGS = 4;
const DEFAULT_SERVING_GRAMS = 350;
const MAX_INGREDIENTS = 100;
const MAX_INSTRUCTIONS = 30;

const emptyNutrition: Nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 };

const fetchFailureMessages: Record<PageFetchFailure, string> = {
  "invalid-url": "Paste a full https link to a public recipe page.",
  blocked: "That site blocked the import. Copy the recipe text and paste it instead.",
  unreachable: "That page could not be reached. Copy the recipe text and paste it instead.",
  "not-html": "That link is not a web page. Copy the recipe text and paste it instead.",
};

type QuotaState = { ok: true } | { ok: false; retryAfterSeconds: number };

/** Per-user rolling hourly quota, stored the way the generate cooldown is: one row, the user's own token, RLS-scoped. */
async function consumeImportQuota(token: string, userId: string): Promise<QuotaState> {
  const now = Date.now();
  const response = await supabaseRest("recipe_import_log?select=window_start,count", token);
  const rows = response.ok ? await response.json() as Array<{ window_start?: string; count?: number }> : [];
  const row = rows[0];
  const windowStart = row?.window_start ? new Date(row.window_start).getTime() : 0;
  const withinWindow = Boolean(windowStart) && now - windowStart < IMPORT_WINDOW_MS;
  const used = withinWindow ? row?.count ?? 0 : 0;

  if (used >= IMPORT_LIMIT) {
    return { ok: false, retryAfterSeconds: Math.ceil((IMPORT_WINDOW_MS - (now - windowStart)) / 1000) };
  }

  await supabaseRest("recipe_import_log", token, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      user_id: userId,
      window_start: withinWindow ? new Date(windowStart).toISOString() : new Date(now).toISOString(),
      count: used + 1,
    }),
  });
  return { ok: true };
}

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    servings: { type: "number" },
    ingredients: { type: "array", items: { type: "string" }, maxItems: 40 },
    instructions: { type: "array", items: { type: "string" }, maxItems: 20 },
  },
  required: ["name", "ingredients", "instructions"],
};

/**
 * Extraction, not generation: the model may only restate the recipe already in the text.
 * This is deliberately the opposite instruction from /api/recipes/generate, which writes
 * an original recipe from a dish concept.
 */
async function extractRecipeFromText(ai: WorkersAi, text: string): Promise<ParsedRecipe | undefined> {
  const request = {
    messages: [
      {
        role: "system",
        content: "Extract the recipe that is already present in the text you are given. Copy the ingredient lines and the cooking steps as they are written, keeping every amount and unit exactly as stated. Do not invent, substitute, reorder, or embellish anything, and do not add ingredients or steps the text does not contain. If the text contains no recipe, return an empty ingredients array.",
      },
      { role: "user", content: `${text}\n\nReturn the recipe exactly as written above.` },
    ],
    response_format: { type: "json_schema", json_schema: { name: "imported_recipe", strict: true, schema: extractionSchema } },
    chat_template_kwargs: { thinking: false },
    max_completion_tokens: 1_200,
    temperature: 0,
  };

  let output = "";
  try { output = extractOutputText(await ai.run(workersAiModels.coach, request)) || ""; } catch { /* fall through to the relaxed schema */ }
  let parsed = output ? importedRecipeSchema.safeParse(parseJsonObject(output)) : { success: false } as const;
  if (!parsed.success) {
    try { output = extractOutputText(await ai.run(workersAiModels.coach, { ...request, response_format: { type: "json_object" } })) || ""; } catch { output = ""; }
    parsed = output ? importedRecipeSchema.safeParse(parseJsonObject(output)) : { success: false } as const;
  }
  if (!parsed.success || !parsed.data.ingredients.length) return undefined;
  return { name: parsed.data.name, servings: parsed.data.servings, servingGrams: parsed.data.servingGrams, ingredients: parsed.data.ingredients, instructions: parsed.data.instructions };
}

/**
 * One decimal place, matching the composer's `step="0.1"` nutrition inputs. Publishers commonly
 * emit two decimals ("334.88 kcal"), which the browser rejects as a step mismatch and — because
 * the fields sit inside a collapsed disclosure — silently refuses to submit.
 */
function roundNutrition(nutrition: Nutrition): Nutrition {
  const round = (value: number) => Math.round(value * 10) / 10;
  return { calories: round(nutrition.calories), protein: round(nutrition.protein), carbs: round(nutrition.carbs), fat: round(nutrition.fat), fiber: round(nutrition.fiber), sugar: round(nutrition.sugar) };
}

/** The page's own nutrition, used only when it is complete enough to trust over an estimate. */
function nutritionFromPage(parsed: ParsedNutrition | undefined): Nutrition | undefined {
  if (!parsed?.calories) return undefined;
  const macros = [parsed.protein, parsed.carbs, parsed.fat].filter((value) => value !== undefined);
  if (macros.length < 2) return undefined;
  return {
    calories: parsed.calories,
    protein: parsed.protein ?? 0,
    carbs: parsed.carbs ?? 0,
    fat: parsed.fat ?? 0,
    fiber: parsed.fiber ?? 0,
    sugar: parsed.sugar ?? 0,
  };
}

/** The composer numbers steps itself, so a step must not arrive carrying "1." or a bullet. */
function stripStepMarker(step: string): string {
  return step.replace(/^\s*(?:step\s*)?(?:\d+\s*[.):\-]|[-–—•*])\s*/i, "").trim();
}

/** Last-resort title for pasted text: its first short, non-empty line, which is nearly always the dish name. */
function titleFromText(text: string): string | undefined {
  const line = text.split("\n").map((entry) => entry.trim()).find((entry) => entry.length > 2 && entry.length <= 120);
  return line && !/^ingredients?$|^instructions?$|^directions?$/i.test(line) ? line : undefined;
}

function knownCuisine(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const key = value.trim().toLowerCase().replace(/[^a-z]/g, "");
  return Object.values(cuisines).find((cuisine) => cuisine.toLowerCase() === key);
}

export async function POST(request: NextRequest) {
  const auth = await authenticatePaidFeature(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = recipeImportRequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Paste a recipe link, or paste the recipe text itself." }, { status: 400 });
  }

  try {
    const quota = await consumeImportQuota(auth.token, auth.userId);
    if (!quota.ok) {
      return NextResponse.json({ error: "You've imported a lot of recipes in the last hour. Try again shortly.", retryAfterSeconds: quota.retryAfterSeconds }, { status: 429 });
    }

    const url = "url" in body.data ? body.data.url : undefined;
    const pastedText = "text" in body.data ? body.data.text : undefined;
    let html = "";
    let sourceUrl: string | undefined;

    if (url) {
      const page = await safeFetchPage(url);
      if (!page.ok) {
        return NextResponse.json({ error: fetchFailureMessages[page.reason] }, { status: page.reason === "invalid-url" ? 400 : 502 });
      }
      html = page.html;
      sourceUrl = page.finalUrl;
    }

    const meta = html ? extractMetaTags(html) : {};
    let extraction: typeof recipeImportExtractions[keyof typeof recipeImportExtractions] = recipeImportExtractions.structured;
    let parsed = html ? parseSchemaRecipe(findRecipeNode(extractJsonLdBlocks(html))) : undefined;

    if (!parsed?.ingredients.length && html) {
      const microdata = parseMicrodataRecipe(html);
      if (microdata?.ingredients.length) { parsed = microdata; extraction = recipeImportExtractions.microdata; }
    }

    if (!parsed?.ingredients.length) {
      const text = pastedText || htmlToText(html);
      extraction = pastedText ? recipeImportExtractions.aiPasted : recipeImportExtractions.aiText;
      parsed = text ? await extractRecipeFromText(await getWorkersAi(), text) : undefined;
    }

    if (!parsed?.ingredients.length) {
      // Telling someone who already pasted their recipe to "paste it instead" is useless advice.
      const message = pastedText
        ? "We couldn't pick a recipe out of that text. Make sure the ingredients and steps are included, then try again."
        : "We couldn't find a recipe on that page. Copy the recipe text and paste it instead.";
      return NextResponse.json({ error: message }, { status: 422 });
    }

    const ingredients = splitIngredientLines(parsed.ingredients).slice(0, MAX_INGREDIENTS);
    const instructions = parsed.instructions.map(stripStepMarker).filter(Boolean).slice(0, MAX_INSTRUCTIONS);
    const servings = parsed.servings ?? DEFAULT_SERVINGS;
    const servingGrams = parsed.servingGrams ?? DEFAULT_SERVING_GRAMS;
    const name = (parsed.name || meta.title || (pastedText ? titleFromText(pastedText) : undefined) || "Imported recipe").slice(0, 240);

    let nutritionPerServing = nutritionFromPage(parsed.nutrition);
    let nutritionSource: typeof recipeImportNutritionSources[keyof typeof recipeImportNutritionSources] = nutritionPerServing ? recipeImportNutritionSources.site : recipeImportNutritionSources.none;
    let confidence: "low" | "medium" | "high" = extraction === recipeImportExtractions.structured ? "high" : "medium";

    if (!nutritionPerServing) {
      const estimateInput = { ingredients: parsed.ingredients.slice(0, 30), servings, servingGrams };
      const estimate = isEstimatableRecipe(estimateInput) ? await estimateRecipeNutrition(await getWorkersAi(), estimateInput) : undefined;
      if (estimate) {
        nutritionPerServing = estimate.nutritionPerServing;
        nutritionSource = recipeImportNutritionSources.estimated;
        confidence = estimate.confidence;
      }
    }

    const result = recipeImportResultSchema.parse({
      recipe: {
        name,
        servings,
        servingGrams,
        ingredients,
        instructions,
        // Zeros are an honest "unknown" the user fills in; a failed estimate must never block the save.
        nutritionPerServing: nutritionPerServing ? roundNutrition(nutritionPerServing) : emptyNutrition,
        cuisine: knownCuisine(parsed.cuisine),
        dietaryTags: dietaryTagsFor(ingredients.map((item) => item.name), nutritionPerServing),
      },
      source: {
        url: sourceUrl,
        siteName: meta.siteName || (sourceUrl ? siteNameFromUrl(sourceUrl) : undefined),
        imageUrl: parsed.imageUrl || meta.imageUrl,
        author: parsed.author,
      },
      extraction,
      nutritionSource,
      confidence: nutritionPerServing ? confidence : "low",
    });

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "That recipe could not be imported right now. Try again later." }, { status: 500 });
  }
}
