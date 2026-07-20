import { serverEnv } from "./env";

export type PaidFeatureAuthConfig = {
  supabaseUrl?: string;
  publishableKey?: string;
};

export type PaidFeatureAuthResult =
  | { ok: true; token: string; userId: string }
  | { ok: false; status: 401 | 503; error: string };

export async function authenticatePaidFeature(
  request: Request,
  config: PaidFeatureAuthConfig = {
    supabaseUrl: serverEnv.SUPABASE_URL || serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: serverEnv.SUPABASE_PUBLISHABLE_KEY || serverEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
): Promise<PaidFeatureAuthResult> {
  const { supabaseUrl, publishableKey } = config;
  if (!supabaseUrl || !publishableKey) {
    return { ok: false, status: 503, error: "Account verification is not configured yet." };
  }

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return { ok: false, status: 401, error: "Sign in to use AI features." };

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, status: 401, error: "Your session expired. Please sign in again." };
    const user: unknown = await response.json();
    const userId = user && typeof user === "object" ? Reflect.get(user, "id") : undefined;
    if (typeof userId !== "string" || !userId) {
      return { ok: false, status: 401, error: "Your session could not be verified." };
    }
    return { ok: true, token, userId };
  } catch {
    return { ok: false, status: 503, error: "Account verification is temporarily unavailable." };
  }
}
