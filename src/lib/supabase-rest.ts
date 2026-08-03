import { serverEnv } from "./env";

/**
 * Minimal PostgREST client for server routes that must write on a signed-in user's behalf.
 * This project has no Supabase service-role key: every write is scoped by RLS to whichever
 * user's bearer token is forwarded, the same technique `authenticatePaidFeature` uses for
 * `/auth/v1/user`.
 */
export async function supabaseRest(path: string, token: string, init: RequestInit = {}) {
  const supabaseUrl = serverEnv.SUPABASE_URL || serverEnv.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = serverEnv.SUPABASE_PUBLISHABLE_KEY || serverEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) throw new Error("Cloud sync is not configured.");
  return fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: publishableKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
}
