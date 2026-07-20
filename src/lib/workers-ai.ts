import { getCloudflareContext } from "@opennextjs/cloudflare";

export const workersAiModels = {
  coach: "@cf/zai-org/glm-4.7-flash",
  coachVision: "@cf/moonshotai/kimi-k2.6",
  label: "@cf/moonshotai/kimi-k2.6",
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
