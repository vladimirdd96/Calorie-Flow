/** Shared response parsing for Workers AI text/chat completions, used by AI-backed API routes. */

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textContent(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return undefined;
  const text = value.map((part) => {
    if (typeof part === "string") return part;
    if (!isRecord(part)) return "";
    return typeof part.text === "string" ? part.text : typeof part.content === "string" ? part.content : "";
  }).join("").trim();
  return text || undefined;
}

/** Pulls the assistant's text out of a Workers AI response, tolerating the shapes different models return. */
export function extractOutputText(response: unknown): string | undefined {
  if (!isRecord(response)) return undefined;
  if (Array.isArray(response.choices)) {
    const choice = response.choices[0];
    if (isRecord(choice)) {
      if (isRecord(choice.message)) {
        const content = textContent(choice.message.content);
        if (content) return content;
      }
      if (typeof choice.text === "string") return choice.text;
    }
  }
  for (const key of ["response", "output_text", "result"] as const) {
    const content = textContent(response[key]);
    if (content) return content;
    const nested = response[key];
    if (isRecord(nested) && Array.isArray(nested.choices)) {
      const choice = nested.choices[0];
      if (isRecord(choice) && isRecord(choice.message)) {
        const nestedContent = textContent(choice.message.content);
        if (nestedContent) return nestedContent;
      }
    }
  }
  return undefined;
}

/** Parses a JSON object out of model output, tolerating a fenced code block or surrounding prose. */
export function parseJsonObject(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try { return JSON.parse(cleaned); } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return undefined;
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return undefined; }
  }
}
