import { NextRequest, NextResponse } from "next/server";
import { authenticatePaidFeature } from "@/lib/server-auth";
import { labelAnalysisSchema } from "@/lib/schemas";
import { getWorkersAi, workersAiModels } from "@/lib/workers-ai";

export const runtime = "nodejs";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    productName: { type: ["string", "null"] },
    brand: { type: ["string", "null"] },
    barcode: { type: ["string", "null"] },
    per100: {
      type: "object",
      additionalProperties: false,
      properties: {
        calories: { type: "number" },
        protein: { type: "number" },
        carbs: { type: "number" },
        fat: { type: "number" },
        fiber: { type: "number" },
        sugar: { type: "number" },
        micronutrients: { type: "object", additionalProperties: false, properties: {
          sodiumMg: { type: "number" }, cholesterolMg: { type: "number" }, saturatedFatG: { type: "number" }, potassiumMg: { type: "number" }, calciumMg: { type: "number" }, ironMg: { type: "number" }, magnesiumMg: { type: "number" }, zincMg: { type: "number" }, vitaminAMcg: { type: "number" }, vitaminCMg: { type: "number" }, vitaminDMcg: { type: "number" }, vitaminEMg: { type: "number" }, vitaminKMcg: { type: "number" }, vitaminB12Mcg: { type: "number" }, folateMcg: { type: "number" },
        }, required: ["sodiumMg", "cholesterolMg", "saturatedFatG", "potassiumMg", "calciumMg", "ironMg", "magnesiumMg", "zincMg", "vitaminAMcg", "vitaminCMg", "vitaminDMcg", "vitaminEMg", "vitaminKMcg", "vitaminB12Mcg", "folateMcg"] },
      },
      required: ["calories", "protein", "carbs", "fat", "fiber", "sugar"],
    },
    servingSizeG: { type: ["number", "null"] },
    packageSizeG: { type: ["number", "null"] },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    needsFollowUp: { type: "boolean" },
    followUpQuestions: { type: "array", items: { type: "string" }, maxItems: 3 },
  },
  required: [
    "productName", "brand", "barcode", "per100", "servingSizeG", "packageSizeG",
    "confidence", "needsFollowUp", "followUpQuestions",
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function extractOutputText(response: unknown) {
  if (!isRecord(response)) return undefined;
  const contentText = (value: unknown): string | undefined => {
    if (typeof value === "string") return value;
    if (!Array.isArray(value)) return undefined;
    const text = value.map((part) => {
      if (typeof part === "string") return part;
      if (!isRecord(part)) return "";
      return typeof part.text === "string" ? part.text : typeof part.content === "string" ? part.content : "";
    }).join("").trim();
    return text || undefined;
  };
  if (Array.isArray(response.choices)) {
    const choice = response.choices[0];
    if (isRecord(choice)) {
      if (isRecord(choice.message)) {
        const content = contentText(choice.message.content);
        if (content) return content;
      }
      if (typeof choice.text === "string") return choice.text;
    }
  }
  for (const key of ["response", "output_text", "result"] as const) {
    const content = contentText(response[key]);
    if (content) return content;
  }
  return undefined;
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

function isImageData(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image/") && value.length <= 10_000_000;
}

export async function POST(request: NextRequest) {
  const auth = await authenticatePaidFeature(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const requestBody: unknown = await request.json();
    const imagePayload = requestBody && typeof requestBody === "object" ? requestBody as { image?: unknown; images?: unknown } : {};
    const images = Array.isArray(imagePayload.images) ? imagePayload.images : [imagePayload.image];
    const validImages = images.filter(isImageData);
    if (!images.length || images.length > 3 || validImages.length !== images.length) {
      return NextResponse.json({ error: "Add one to three package photos, each under 10 MB." }, { status: 400 });
    }

    const ai = await getWorkersAi();
    const requestPayload = {
      messages: [
        {
          role: "system",
          content: "Read one or more photos of the same food package. They may show a nutrition label, barcode, front of pack, ingredients, serving information, or package size. Extract package nutrition accurately and combine facts across images, including sodium, saturated fat, cholesterol, potassium, calcium, iron, magnesium, zinc, and vitamins when visible. Normalize all nutrients to 100 g or 100 ml. If the label only gives a serving, calculate per 100 from the visible serving weight. Use 0 only when the label explicitly indicates zero; otherwise return 0 and add a short follow-up question naming the missing value. Never guess product weight, serving weight, or package weight. Calories are kcal. Keep questions concise and ask only facts needed to log the consumed amount.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Identify this food package and return the structured result. A barcode alone is useful: return it even if other nutrition details are unavailable." },
            ...validImages.map((image) => ({ type: "image_url", image_url: { url: image } })),
          ],
        },
      ],
      response_format: { type: "json_schema", json_schema: { name: "nutrition_label", strict: true, schema } },
      max_completion_tokens: 700,
      temperature: 0,
    };
    let outputText = extractOutputText(await ai.run(workersAiModels.label, requestPayload));
    let parsed = outputText ? labelAnalysisSchema.safeParse(parseJson(outputText)) : { success: false } as const;
    if (!parsed.success) {
      outputText = extractOutputText(await ai.run(workersAiModels.label, { ...requestPayload, response_format: { type: "json_object" } }));
      parsed = outputText ? labelAnalysisSchema.safeParse(parseJson(outputText)) : { success: false } as const;
    }
    if (!parsed.success) return NextResponse.json({ error: "The label service returned invalid nutrition data." }, { status: 502 });
    return NextResponse.json(parsed.data);
  } catch {
    return NextResponse.json({ error: "The label could not be read. Try a sharper, closer photo." }, { status: 500 });
  }
}
