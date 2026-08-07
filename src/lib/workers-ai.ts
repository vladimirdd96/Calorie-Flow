import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Vision models are not interchangeable across Workers AI plans: `@cf/moonshotai/kimi-k2.6`
 * carries `require_workers_paid`, so on a Workers Free account every image request fails
 * with a 403 the routes could only report as "the photo could not be understood". Keep the
 * image models on a plan-independent one so meal photos, labels, and Coach images work on
 * both plans; `@cf/meta/llama-4-scout-17b-16e-instruct` also supports strict JSON schemas.
 */
export const workersAiModels = {
  coach: "@cf/zai-org/glm-4.7-flash",
  coachVision: "@cf/meta/llama-4-scout-17b-16e-instruct",
  label: "@cf/meta/llama-4-scout-17b-16e-instruct",
  mealPhoto: "@cf/meta/llama-4-scout-17b-16e-instruct",
} as const;

export type WorkersAi = {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
};

function isWorkersAi(value: unknown): value is WorkersAi {
  if (!value || typeof value !== "object") return false;
  return "run" in value && typeof value.run === "function";
}

/** Returns the managed Workers AI binding; no provider credential is exposed to the app. */
export async function getWorkersAi(): Promise<WorkersAi> {
  const { env } = await getCloudflareContext({ async: true });
  const ai = (env as Record<string, unknown>).AI;
  if (!isWorkersAi(ai)) throw new Error("Workers AI is not configured for this deployment.");
  return ai;
}
