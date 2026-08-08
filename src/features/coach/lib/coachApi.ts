import { coachMealActionSchema, coachMealChoiceSchema } from "@/lib/schemas";
import { localDateKey } from "@/lib/nutrition";
import { getSupabase } from "@/lib/supabase";

export type CoachReplyResult = {
  reply: string;
  sources?: Array<{ title: string; url: string }>;
  mealActionResult: ReturnType<typeof coachMealActionSchema.safeParse>;
  mealChoices: Array<ReturnType<typeof coachMealChoiceSchema.parse>>;
};

/** Posts one turn to the Coach endpoint and validates everything it returns. */
export async function requestCoachReply(
  content: string,
  image: string | null | undefined,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  signal: AbortSignal,
): Promise<CoachReplyResult> {
  const session = await getSupabase()?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new Error("Your session expired. Please sign in again.");
  const response = await fetch("/api/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      message: content,
      ...(image ? { image } : {}),
      history,
      localDate: localDateKey(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
    signal,
  });
  const body: unknown = await response.json();
  const bodyRecord = body && typeof body === "object" ? body as Record<string, unknown> : {};
  if (!response.ok) throw new Error(typeof bodyRecord.error === "string" ? bodyRecord.error : "The Coach is unavailable right now.");
  if (typeof bodyRecord.reply !== "string") throw new Error("The Coach returned an invalid response.");
  const mealActionResult = coachMealActionSchema.safeParse(bodyRecord.mealAction);
  const mealChoices = Array.isArray(bodyRecord.mealChoices) ? bodyRecord.mealChoices.flatMap((choice) => {
    const parsed = coachMealChoiceSchema.safeParse(choice);
    return parsed.success ? [parsed.data] : [];
  }) : [];
  const sources = Array.isArray(bodyRecord.sources) ? bodyRecord.sources.flatMap((source) => {
    if (!source || typeof source !== "object") return [];
    const record = source as Record<string, unknown>;
    return typeof record.title === "string" && typeof record.url === "string" ? [{ title: record.title, url: record.url }] : [];
  }).slice(0, 6) : undefined;
  return { reply: bodyRecord.reply, sources, mealActionResult, mealChoices };
}

/**
 * Keeps the request below the server's 10 MB boundary even for a very detailed
 * camera capture. Reducing JPEG quality preserves label pixels better than
 * shrinking the image again.
 */
export async function imageToDataUrl(file: File, options: { maxDimension?: number; quality?: number } = {}) {
  const image = await createImageBitmap(file);
  const max = options.maxDimension || 2200;
  const scale = Math.min(1, max / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext("2d");
  context?.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  let quality = options.quality || 0.9;
  let result = canvas.toDataURL("image/jpeg", quality);
  while (result.length > 9_500_000 && quality > 0.72) {
    quality -= 0.06;
    result = canvas.toDataURL("image/jpeg", quality);
  }
  return result;
}
