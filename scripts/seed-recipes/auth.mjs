import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { requireEnv, optionalEnv } from "./env.mjs";

const envPath = new URL("../../.env.local", import.meta.url);

function persistRefreshToken(newToken) {
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  const updated = /^SEED_USER_REFRESH_TOKEN=.*$/m.test(content)
    ? content.replace(/^SEED_USER_REFRESH_TOKEN=.*$/m, `SEED_USER_REFRESH_TOKEN=${newToken}`)
    : `${content}\nSEED_USER_REFRESH_TOKEN=${newToken}\n`;
  writeFileSync(envPath, updated);
}

const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
const publishableKey = requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

let refreshToken = optionalEnv("SEED_USER_REFRESH_TOKEN");
const staticAccessToken = optionalEnv("SEED_USER_ACCESS_TOKEN");
if (!refreshToken && !staticAccessToken) {
  throw new Error("Set SEED_USER_REFRESH_TOKEN (preferred, auto-renews) or SEED_USER_ACCESS_TOKEN in .env.local");
}

let cachedAccessToken = staticAccessToken ?? null;
let cachedExpiresAt = staticAccessToken ? Infinity : 0;

async function refresh() {
  if (!refreshToken) {
    throw new Error(
      "Access token expired and no SEED_USER_REFRESH_TOKEN is set. Paste a fresh SEED_USER_ACCESS_TOKEN (or a refresh_token) into .env.local and rerun.",
    );
  }
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: publishableKey },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Refresh token rejected (${response.status}): ${body}\nPaste a fresh SEED_USER_REFRESH_TOKEN into .env.local and rerun.`,
    );
  }
  const data = await response.json();
  cachedAccessToken = data.access_token;
  cachedExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000;
  if (data.refresh_token && data.refresh_token !== refreshToken) {
    refreshToken = data.refresh_token;
    persistRefreshToken(refreshToken);
  }
  return cachedAccessToken;
}

export async function getAccessToken({ forceRefresh = false } = {}) {
  if (!forceRefresh && cachedAccessToken && Date.now() < cachedExpiresAt) return cachedAccessToken;
  return refresh();
}

export const supabaseRestUrl = `${supabaseUrl}/rest/v1`;
export { publishableKey };
