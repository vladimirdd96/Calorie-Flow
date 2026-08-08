import { createClient } from "@supabase/supabase-js";

const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.API_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.ANON_KEY;
const email = "calorie-flow-agent@local.test";
const password = "local-agent-fixture-only";

function required(value, name) {
  if (!value) throw new Error(`${name} is required. Run \`supabase status -o env\` after \`supabase start --exclude vector\`.`);
  return value;
}

function assertLocalUrl(value) {
  const url = new URL(value);
  if (!localHosts.has(url.hostname)) {
    throw new Error("test:auth only accepts a local Supabase URL. It must never authenticate against a hosted project.");
  }
  return url.toString();
}

const client = createClient(assertLocalUrl(required(supabaseUrl, "SUPABASE_URL or API_URL")), required(publishableKey, "SUPABASE_PUBLISHABLE_KEY or ANON_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { error: signUpError } = await client.auth.signUp({ email, password });
if (signUpError && !/already registered|already exists/i.test(signUpError.message)) {
  throw new Error(`Could not create the disposable local test account: ${signUpError.message}`);
}

const { data: signInData, error: signInError } = await client.auth.signInWithPassword({ email, password });
if (signInError || !signInData.user) {
  throw new Error(`Could not sign in with the disposable local test account: ${signInError?.message ?? "no user returned"}`);
}

const profile = {
  user_id: signInData.user.id,
  data: { source: "auth-smoke", testedAt: "1970-01-01T00:00:00.000Z" },
};
const { error: upsertError } = await client.from("user_profiles").upsert(profile);
if (upsertError) throw new Error(`Authenticated profile write failed: ${upsertError.message}`);

const { data: savedProfile, error: selectError } = await client
  .from("user_profiles")
  .select("user_id, data")
  .eq("user_id", signInData.user.id)
  .single();
if (selectError || savedProfile?.user_id !== signInData.user.id || savedProfile.data?.source !== "auth-smoke") {
  throw new Error(`Authenticated profile read failed: ${selectError?.message ?? "unexpected profile data"}`);
}

const { error: deleteError } = await client.from("user_profiles").delete().eq("user_id", signInData.user.id);
if (deleteError) throw new Error(`Authenticated profile cleanup failed: ${deleteError.message}`);

await client.auth.signOut();
console.log("Local Supabase password authentication and profile RLS smoke test passed.");
