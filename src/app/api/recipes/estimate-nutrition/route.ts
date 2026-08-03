import { NextRequest, NextResponse } from "next/server";
import { authenticatePaidFeature } from "@/lib/server-auth";
import { recipeNutritionEstimateSchema } from "@/lib/schemas";
import { getWorkersAi, workersAiModels } from "@/lib/workers-ai";
import { extractOutputText, parseJsonObject } from "@/lib/workers-ai-text";

export const runtime = "nodejs";

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    nutritionPerServing: {
      type: "object",
      additionalProperties: false,
      properties: {
        calories: { type: "number" }, protein: { type: "number" }, carbs: { type: "number" },
        fat: { type: "number" }, fiber: { type: "number" }, sugar: { type: "number" },
      },
      required: ["calories", "protein", "carbs", "fat", "fiber", "sugar"],
    },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["nutritionPerServing", "confidence"],
};

type RequestBody = { ingredients?: unknown; servings?: unknown; servingGrams?: unknown };

function isIngredientList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 30
    && value.every((item) => typeof item === "string" && item.trim().length > 0 && item.length <= 240);
}

async function askForEstimate(ai: Awaited<ReturnType<typeof getWorkersAi>>, ingredients: string[], servings: number, servingGrams: number, strict: boolean) {
  return ai.run(workersAiModels.coach, {
    messages: [
      {
        role: "system",
        content: "Estimate nutrition for a home-cooked recipe from its ingredient list. Reason about typical quantities implied by the ingredient names and the stated servings/serving size, then return per-serving totals. Be conservative and realistic — this is an estimate a user can still edit, not a lab measurement. Calories are kcal.",
      },
      {
        role: "user",
        content: `Recipe makes ${servings} serving(s), about ${servingGrams} g per serving. Ingredients:\n${ingredients.map((item) => `- ${item}`).join("\n")}\n\nReturn nutritionPerServing (calories, protein, carbs, fat, fiber, sugar) and a confidence level.`,
      },
    ],
    ...(strict ? { response_format: { type: "json_schema", json_schema: { name: "recipe_nutrition_estimate", strict: true, schema: responseSchema } } } : { response_format: { type: "json_object" } }),
    chat_template_kwargs: { thinking: false },
    max_completion_tokens: 400,
    temperature: 0,
  });
}

export async function POST(request: NextRequest) {
  const auth = await authenticatePaidFeature(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json() as RequestBody;
    const ingredients = body.ingredients;
    const servings = typeof body.servings === "number" && Number.isFinite(body.servings) && body.servings > 0 ? body.servings : undefined;
    const servingGrams = typeof body.servingGrams === "number" && Number.isFinite(body.servingGrams) && body.servingGrams > 0 ? body.servingGrams : undefined;
    if (!isIngredientList(ingredients) || !servings || !servingGrams) {
      return NextResponse.json({ error: "Add ingredients, servings, and grams per serving first." }, { status: 400 });
    }

    const ai = await getWorkersAi();
    let text = "";
    try { text = extractOutputText(await askForEstimate(ai, ingredients, servings, servingGrams, true)) || ""; } catch { /* Some deployments do not support strict schemas. */ }
    let parsed = text ? recipeNutritionEstimateSchema.safeParse(parseJsonObject(text)) : { success: false } as const;
    if (!parsed.success) {
      try { text = extractOutputText(await askForEstimate(ai, ingredients, servings, servingGrams, false)) || ""; } catch { text = ""; }
      parsed = text ? recipeNutritionEstimateSchema.safeParse(parseJsonObject(text)) : { success: false } as const;
    }
    if (!parsed.success) return NextResponse.json({ error: "The estimate service did not return usable nutrition data." }, { status: 502 });
    return NextResponse.json(parsed.data);
  } catch {
    return NextResponse.json({ error: "The nutrition estimate could not be generated. You can still enter it manually." }, { status: 500 });
  }
}
