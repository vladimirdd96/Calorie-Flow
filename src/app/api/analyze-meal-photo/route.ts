import { NextRequest, NextResponse } from "next/server";
import { authenticatePaidFeature } from "@/lib/server-auth";
import { mealPhotoAnalysisSchema } from "@/lib/schemas";
import { getWorkersAi, workersAiModels } from "@/lib/workers-ai";

export const runtime = "nodejs";

const nutritionSchema = {
  type: "object", additionalProperties: false,
  properties: { calories: { type: "number" }, protein: { type: "number" }, carbs: { type: "number" }, fat: { type: "number" }, fiber: { type: "number" }, sugar: { type: "number" } },
  required: ["calories", "protein", "carbs", "fat", "fiber", "sugar"],
};

const responseSchema = {
  type: "object", additionalProperties: false,
  properties: {
    name: { type: "string" },
    mealType: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    items: {
      type: "array", minItems: 1, maxItems: 12,
      items: {
        type: "object", additionalProperties: false,
        properties: { name: { type: "string" }, portion: { type: "string" }, grams: { type: "number" }, nutrition: nutritionSchema },
        required: ["name", "portion", "grams", "nutrition"],
      },
    },
  }, required: ["name", "mealType", "confidence", "items"],
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

const systemPrompt = [
  "You estimate meals from images for a calorie diary. These are estimates, not laboratory values: always return your best reasonable guess and never refuse or return an empty item list.",
  "The image may be a plated meal, a lunchbox, a takeaway tray, a menu, a recipe card, or a screenshot of another calorie app. Read every piece of visible text first.",
  "When the image already shows nutrition numbers — a calorie-app screenshot, a menu line, a recipe card, a nutrition table — copy those numbers exactly instead of estimating them, and set confidence high.",
  "Otherwise split the meal into the distinct foods you can see and estimate each one's served weight in grams from visual cues: plate and bowl diameter, cutlery, hands, cans, and packaging.",
  "List visible cooking oil, butter, sauces, and dressings as their own item whenever they materially change the calories.",
  "portion is a short human phrase for what is shown, such as \"1 medium breast\", \"1 cup cooked\", or \"2 tbsp\". grams is that portion's weight, and nutrition describes that exact portion — never per 100 g.",
  "Pick mealType from the food and any visible time. Use confidence low when the photo is blurry, food is hidden or stacked, or the portion is genuinely hard to judge, and medium when the foods are clear but the weights are inferred.",
].join(" ");

function userPrompt(hint: string) {
  const base = "Estimate this meal for my diary and return only the JSON.";
  return hint ? `${base} The user adds: "${hint}". Trust their description over your visual guess wherever the two disagree, and fold it into the items.` : base;
}

async function askVision(ai: Awaited<ReturnType<typeof getWorkersAi>>, image: string, hint: string, strict: boolean) {
  return ai.run(workersAiModels.mealPhoto, {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: [{ type: "text", text: userPrompt(hint) }, { type: "image_url", image_url: { url: image } }] },
    ],
    ...(strict ? { response_format: { type: "json_schema", json_schema: { name: "meal_photo", strict: true, schema: responseSchema } } } : { response_format: { type: "json_object" } }),
    chat_template_kwargs: { thinking: false },
    max_completion_tokens: 1_400, temperature: 0,
  });
}

export async function POST(request: NextRequest) {
  const auth = await authenticatePaidFeature(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const body: unknown = await request.json();
    const payload = body && typeof body === "object" ? body as { image?: unknown; hint?: unknown } : {};
    const image = payload.image;
    if (!imageData(image)) return NextResponse.json({ error: "Add one photo under 10 MB." }, { status: 400 });
    const hint = typeof payload.hint === "string" ? payload.hint.trim().slice(0, 280) : "";
    const ai = await getWorkersAi();
    let text = "";
    try { text = outputText(await askVision(ai, image, hint, true)) || ""; } catch { /* Some deployments do not support strict vision schemas. */ }
    let parsed = text ? mealPhotoAnalysisSchema.safeParse(parseJson(text)) : { success: false } as const;
    if (!parsed.success) {
      try { text = outputText(await askVision(ai, image, hint, false)) || ""; } catch { text = ""; }
      parsed = text ? mealPhotoAnalysisSchema.safeParse(parseJson(text)) : { success: false } as const;
    }
    if (!parsed.success) return NextResponse.json({ error: text ? "The photo service returned invalid meal data." : "The photo service did not return readable meal data. Try again or choose a clearer photo." }, { status: 502 });
    return NextResponse.json(parsed.data);
  } catch {
    return NextResponse.json({ error: "The meal photo could not be understood. Try a clearer photo." }, { status: 500 });
  }
}
