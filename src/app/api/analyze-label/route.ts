import { NextRequest, NextResponse } from "next/server";

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

function extractOutputText(response: { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }) {
  return response.output
    ?.flatMap((item) => item.content || [])
    .find((item) => item.type === "output_text")?.text;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI label reading is ready but needs an OPENAI_API_KEY on the server." },
      { status: 503 },
    );
  }

  try {
    const { image } = await request.json();
    if (typeof image !== "string" || !image.startsWith("data:image/")) {
      return NextResponse.json({ error: "Please provide a nutrition-label image." }, { status: 400 });
    }
    if (image.length > 10_000_000) {
      return NextResponse.json({ error: "That image is too large. Try a closer crop." }, { status: 413 });
    }

    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
        reasoning: { effort: "none" },
        input: [
          {
            role: "developer",
            content: [{
              type: "input_text",
              text: "Extract package nutrition accurately. Normalize all nutrients to 100 g or 100 ml. If the label only gives a serving, calculate per 100 from the visible serving weight. Use 0 only when the label explicitly indicates zero; otherwise return 0 and add a short follow-up question naming the missing value. Never guess product weight, serving weight, or package weight. Calories are kcal. Keep questions concise and ask only facts needed to log the consumed amount.",
            }],
          },
          {
            role: "user",
            content: [
              { type: "input_text", text: "Read this nutrition label and return the structured result." },
              { type: "input_image", image_url: image, detail: "high" },
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

    const body = await apiResponse.json();
    if (!apiResponse.ok) {
      const message = body?.error?.message || "The label could not be read right now.";
      return NextResponse.json({ error: message }, { status: apiResponse.status });
    }
    const outputText = extractOutputText(body);
    if (!outputText) return NextResponse.json({ error: "No label data was returned." }, { status: 502 });
    return NextResponse.json(JSON.parse(outputText));
  } catch {
    return NextResponse.json({ error: "The label could not be read. Try a sharper, closer photo." }, { status: 500 });
  }
}
