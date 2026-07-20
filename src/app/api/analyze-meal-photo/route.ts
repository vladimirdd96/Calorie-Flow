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

function textContent(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return undefined;
  return value.map((part) => {
    if (typeof part === "string") return part;
    if (!part || typeof part !== "object") return "";
    const item = part as { text?: unknown; content?: unknown };
    return typeof item.text === "string" ? item.text : typeof item.content === "string" ? item.content : "";
  }).join("").trim() || undefined;
}

function outputText(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const record = value as { choices?: unknown; response?: unknown; output_text?: unknown; result?: unknown };
  if (Array.isArray(record.choices)) {
    const choice = record.choices[0];
    if (choice && typeof choice === "object") {
      const message = (choice as { message?: unknown }).message;
      if (message && typeof message === "object") {
        const content = textContent((message as { content?: unknown }).content);
        if (content) return content;
      }
      const content = textContent((choice as { text?: unknown }).text);
      if (content) return content;
    }
  }
  return textContent(record.response) || textContent(record.output_text) || textContent(record.result);
}

function parseJson(text: string) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try { return JSON.parse(cleaned); } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return undefined;
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return undefined; }
  }
}

const systemPrompt = "Analyze any food-related image, not only packaging. It may be a screenshot of another calorie app, a plated meal, a recipe, a menu, or a mixed meal. First read all visible text, especially meal names, dates, calories, protein, carbs, fat, fibre/fiber, sugar, and descriptions. Treat explicit nutrition numbers in the image as authoritative for the combined meal; do not replace them with a fresh estimate. If the image describes components, include them in components. If a meal type is not visible, choose breakfast, lunch, dinner, or snack from the time/context or use the most likely type and keep confidence low. If numbers are missing, estimate each component conservatively and mark confidence low or medium. Return one combined meal with a positive amount and grams. Never invent certainty.";

async function askVision(ai: Awaited<ReturnType<typeof getWorkersAi>>, image: string, strict: boolean) {
  return ai.run(workersAiModels.label, {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: [{ type: "text", text: "Read this food photo or screenshot and return only the meal JSON needed for my diary. Use the exact visible totals when the image contains a nutrition summary." }, { type: "image_url", image_url: { url: image } }] },
    ],
    ...(strict ? { response_format: { type: "json_schema", json_schema: { name: "meal_photo", strict: true, schema: responseSchema } } } : { response_format: { type: "json_object" } }),
    chat_template_kwargs: { thinking: false },
    max_completion_tokens: 900, temperature: 0,
  });
}

export async function POST(request: NextRequest) {
  const auth = await authenticatePaidFeature(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const body: unknown = await request.json();
    const image = body && typeof body === "object" ? (body as { image?: unknown }).image : undefined;
    if (!imageData(image)) return NextResponse.json({ error: "Add one photo under 10 MB." }, { status: 400 });
    const ai = await getWorkersAi();
    let text = "";
    try { text = outputText(await askVision(ai, image, true)) || ""; } catch { /* Some deployments do not support strict vision schemas. */ }
    let parsed = text ? mealPhotoAnalysisSchema.safeParse(parseJson(text)) : { success: false } as const;
    if (!parsed.success) {
      try { text = outputText(await askVision(ai, image, false)) || ""; } catch { text = ""; }
      parsed = text ? mealPhotoAnalysisSchema.safeParse(parseJson(text)) : { success: false } as const;
    }
    if (!parsed.success) return NextResponse.json({ error: text ? "The photo service returned invalid meal data." : "The photo service did not return readable meal data. Try again or choose a clearer photo." }, { status: 502 });
    return NextResponse.json(parsed.data);
  } catch {
    return NextResponse.json({ error: "The meal photo could not be understood. Try a clearer photo." }, { status: 500 });
  }
}
