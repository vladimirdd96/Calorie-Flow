import { getAccessToken, supabaseRestUrl, restApiKey } from "./supabase-auth.mjs";

/** PostgREST call that transparently refreshes an expired user token once. */
export async function supabaseFetch(path, init = {}, { retry = true } = {}) {
  const token = await getAccessToken();
  const response = await fetch(`${supabaseRestUrl}${path}`, {
    ...init,
    headers: { ...init.headers, apikey: restApiKey, Authorization: `Bearer ${token}` },
  });
  if (response.status === 401 && retry) {
    await getAccessToken({ forceRefresh: true });
    return supabaseFetch(path, init, { retry: false });
  }
  return response;
}
