import { NextRequest, NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { authenticatePaidFeature } from "@/lib/server-auth";
import { labelAnalysisSchema } from "@/lib/schemas";

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

function extractOutputText(response: unknown) {
  if (!response || typeof response !== "object") return undefined;
  const output = Reflect.get(response, "output");
  if (!Array.isArray(output)) return undefined;
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Reflect.get(item, "content");
    if (!Array.isArray(content)) continue;
    for (const entry of content) {
      if (!entry || typeof entry !== "object" || Reflect.get(entry, "type") !== "output_text") continue;
      const text = Reflect.get(entry, "text");
      if (typeof text === "string") return text;
    }
  }
}

function isImageData(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image/") && value.length <= 10_000_000;
}

function upstreamErrorMessage(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const error = Reflect.get(value, "error");
  if (!error || typeof error !== "object") return undefined;
  const message = Reflect.get(error, "message");
  return typeof message === "string" ? message : undefined;
}

export async function POST(request: NextRequest) {
  const auth = await authenticatePaidFeature(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const apiKey = serverEnv.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI label reading is ready but needs an OPENAI_API_KEY on the server." },
      { status: 503 },
    );
  }

  try {
    const requestBody: unknown = await request.json();
    const imagePayload = requestBody && typeof requestBody === "object" ? requestBody as { image?: unknown; images?: unknown } : {};
    const images = Array.isArray(imagePayload.images) ? imagePayload.images : [imagePayload.image];
    const validImages = images.filter(isImageData);
    if (!images.length || images.length > 3 || validImages.length !== images.length) {
      return NextResponse.json({ error: "Add one to three package photos, each under 10 MB." }, { status: 400 });
    }

    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: serverEnv.OPENAI_LABEL_MODEL || "gpt-4.1-mini",
        reasoning: { effort: "none" },
        input: [
          {
            role: "developer",
            content: [{
              type: "input_text",
              text: "Read one or more photos of the same food package. They may show a nutrition label, barcode, front of pack, ingredients, serving information, or package size. Extract package nutrition accurately and combine facts across images. Normalize all nutrients to 100 g or 100 ml. If the label only gives a serving, calculate per 100 from the visible serving weight. Use 0 only when the label explicitly indicates zero; otherwise return 0 and add a short follow-up question naming the missing value. Never guess product weight, serving weight, or package weight. Calories are kcal. Keep questions concise and ask only facts needed to log the consumed amount.",
            }],
          },
          {
            role: "user",
            content: [
              { type: "input_text", text: "Identify this food package and return the structured result. A barcode alone is useful: return it even if other nutrition details are unavailable." },
              ...validImages.map((image) => ({ type: "input_image" as const, image_url: image, detail: "high" as const })),
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "nutrition_label",
            strict: true,
            schema,
          },
        },
      }),
    });

    const responseBody: unknown = await apiResponse.json();
    if (!apiResponse.ok) {
      const message = upstreamErrorMessage(responseBody) || "The label could not be read right now.";
      return NextResponse.json({ error: message }, { status: apiResponse.status });
    }
    const outputText = extractOutputText(responseBody);
    if (!outputText) return NextResponse.json({ error: "No label data was returned." }, { status: 502 });
    const parsed = labelAnalysisSchema.safeParse(JSON.parse(outputText));
    if (!parsed.success) return NextResponse.json({ error: "The label service returned invalid nutrition data." }, { status: 502 });
    return NextResponse.json(parsed.data);
  } catch {
    return NextResponse.json({ error: "The label could not be read. Try a sharper, closer photo." }, { status: 500 });
  }
}
