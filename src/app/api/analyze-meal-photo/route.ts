import { NextRequest, NextResponse } from "next/server";
import { authenticatePaidFeature } from "@/lib/server-auth";
import { mealPhotoAnalysisSchema } from "@/lib/schemas";
import { getWorkersAi, workersAiModels } from "@/lib/workers-ai";

export const runtime = "nodejs";

const responseSchema = {
  type: "object", additionalProperties: false,
  properties: {
    name: { type: "string" }, mealType: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
    amount: { type: "number" }, unit: { type: "string", enum: ["serving", "g", "100g", "package", "piece", "tbsp", "tsp", "ml"] },
    grams: { type: "number" },
    nutrition: { type: "object", additionalProperties: false, properties: {
      calories: { type: "number" }, protein: { type: "number" }, carbs: { type: "number" }, fat: { type: "number" }, fiber: { type: "number" }, sugar: { type: "number" },
    }, required: ["calories", "protein", "carbs", "fat", "fiber", "sugar"] },
    components: { type: "array", items: { type: "string" }, maxItems: 20 }, confidence: { type: "string", enum: ["low", "medium", "high"] },
  }, required: ["name", "mealType", "amount", "unit", "grams", "nutrition", "components", "confidence"],
};

function imageData(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image/") && value.length <= 10_000_000;
}

function outputText(value: unknown) {
  if (!value || typeof value !== "object" || !Array.isArray((value as { choices?: unknown }).choices)) return undefined;
  const choice = (value as { choices: unknown[] }).choices[0];
  if (!choice || typeof choice !== "object") return undefined;
  const message = (choice as { message?: unknown }).message;
  return message && typeof message === "object" && typeof (message as { content?: unknown }).content === "string"
    ? (message as { content: string }).content : undefined;
}

export async function POST(request: NextRequest) {
  const auth = await authenticatePaidFeature(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const body: unknown = await request.json();
    const image = body && typeof body === "object" ? (body as { image?: unknown }).image : undefined;
    if (!imageData(image)) return NextResponse.json({ error: "Add one photo under 10 MB." }, { status: 400 });
    const response = await (await getWorkersAi()).run(workersAiModels.label, {
      messages: [
        { role: "system", content: "Analyze any food-related image, not only packaging. It may be a screenshot of another calorie app, a plated meal, a recipe, a menu, or a mixed meal. Extract the meal and visible nutrition numbers when present. Prefer explicit numbers in the image over estimates. If numbers are missing, estimate each component conservatively and mark confidence low or medium. Return one combined meal; list its components. Use grams for the best estimate and kcal for calories. Never invent certainty." },
        { role: "user", content: [{ type: "text", text: "Understand this food photo or screenshot and prepare a meal entry for my diary." }, { type: "image_url", image_url: { url: image } }] },
      ],
      response_format: { type: "json_schema", json_schema: { name: "meal_photo", strict: true, schema: responseSchema } },
      max_completion_tokens: 900, temperature: 0,
    });
    const text = outputText(response);
    if (!text) return NextResponse.json({ error: "No meal data was returned." }, { status: 502 });
    const parsed = mealPhotoAnalysisSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return NextResponse.json({ error: "The photo service returned invalid meal data." }, { status: 502 });
    return NextResponse.json(parsed.data);
  } catch {
    return NextResponse.json({ error: "The meal photo could not be understood. Try a clearer photo." }, { status: 500 });
  }
}
