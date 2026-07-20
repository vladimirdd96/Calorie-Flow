import { createClient, type Provider, type SupabaseClient, type User } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

const supabaseUrl = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const canonicalAppUrl = publicEnv.NEXT_PUBLIC_APP_URL;

const productionAppOrigin = "https://calorie-flow.vladimirdd96.workers.dev";

export function getAppOrigin() {
  if (canonicalAppUrl) return new URL(canonicalAppUrl).origin;
  if (typeof window === "undefined") return productionAppOrigin;
  return window.location.hostname.endsWith(".chatgpt.site") ? productionAppOrigin : window.location.origin;
}

export function getAuthCallbackUrl() {
  return new URL("/auth/callback", getAppOrigin()).toString();
}

export const cloudSyncConfigured = Boolean(supabaseUrl && supabaseKey);

let client: SupabaseClient | null = null;

export function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  if (!client) {
    client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Auth callbacks are exchanged explicitly so the code can be removed from the URL.
        detectSessionInUrl: false,
        flowType: "pkce",
      },
    });
  }
  return client;
}

export type CloudUser = User;
export type SocialAuthProvider = Extract<Provider, "google">;
