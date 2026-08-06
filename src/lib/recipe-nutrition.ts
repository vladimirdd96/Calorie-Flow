import { recipeNutritionEstimateSchema } from "./schemas";
import { workersAiModels, type WorkersAi } from "./workers-ai";
import { extractOutputText, parseJsonObject } from "./workers-ai-text";
import type { z } from "zod";

/**
 * Shared per-serving nutrition estimate. Both the recipe composer's "Re-estimate" button and
 * the link importer go through here so an estimate means the same thing wherever it appears.
 */

export type RecipeNutritionEstimate = z.infer<typeof recipeNutritionEstimateSchema>;

export const MAX_ESTIMATE_INGREDIENTS = 30;

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

export type RecipeNutritionInput = { ingredients: string[]; servings: number; servingGrams: number };

/** Rejects the shapes the model cannot usefully estimate from, before any inference is spent. */
export function isEstimatableRecipe(value: { ingredients?: unknown; servings?: unknown; servingGrams?: unknown }): value is RecipeNutritionInput {
  const { ingredients, servings, servingGrams } = value;
  if (!Array.isArray(ingredients) || !ingredients.length || ingredients.length > MAX_ESTIMATE_INGREDIENTS) return false;
  if (!ingredients.every((item) => typeof item === "string" && item.trim().length > 0 && item.length <= 240)) return false;
  return [servings, servingGrams].every((entry) => typeof entry === "number" && Number.isFinite(entry) && entry > 0);
}

function askForEstimate(ai: WorkersAi, { ingredients, servings, servingGrams }: RecipeNutritionInput, strict: boolean) {
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

/** Returns undefined when the model gave nothing usable; callers decide whether that is fatal. */
export async function estimateRecipeNutrition(ai: WorkersAi, input: RecipeNutritionInput): Promise<RecipeNutritionEstimate | undefined> {
  let text = "";
  try { text = extractOutputText(await askForEstimate(ai, input, true)) || ""; } catch { /* Some deployments do not support strict schemas. */ }
  let parsed = text ? recipeNutritionEstimateSchema.safeParse(parseJsonObject(text)) : { success: false } as const;
  if (!parsed.success) {
    try { text = extractOutputText(await askForEstimate(ai, input, false)) || ""; } catch { text = ""; }
    parsed = text ? recipeNutritionEstimateSchema.safeParse(parseJsonObject(text)) : { success: false } as const;
  }
  return parsed.success ? parsed.data : undefined;
}
