import { createClient, type Provider, type SupabaseClient, type User } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

const supabaseUrl = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const cloudSyncConfigured = Boolean(supabaseUrl && supabaseKey);

let client: SupabaseClient | null = null;

export function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  if (!client) {
    client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    });
  }
  return client;
}

export type CloudUser = User;
export type SocialAuthProvider = Extract<Provider, "apple" | "google">;
