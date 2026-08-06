/**
 * Fetches a page the user pasted. This is the one place the app follows a URL it did not
 * choose, so the guards live here rather than relying on the runtime: the
 * `global_fetch_strictly_public` compatibility flag protects the deployed Worker, but
 * `next dev` runs on plain Node with no such protection.
 */

export const MAX_URL_LENGTH = 2_000;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8_000;
const USER_AGENT = "Calorie Flow/1.0 (recipe-import)";

export type PageFetchFailure = "invalid-url" | "blocked" | "unreachable" | "not-html";
export type PageFetchResult =
  | { ok: true; html: string; finalUrl: string }
  | { ok: false; reason: PageFetchFailure };

const blockedHostSuffixes = [".local", ".internal", ".localhost", ".home.arpa"];
const ipv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/** Rejects anything that is not a public https page: non-https schemes, IP literals, and loopback/internal names. */
export function isImportableUrl(raw: string): boolean {
  if (!raw || raw.length > MAX_URL_LENGTH) return false;
  let url: URL;
  try { url = new URL(raw); } catch { return false; }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost") return false;
  if (host.startsWith("[") || host.includes(":")) return false; // bracketed or bare IPv6 literal
  if (ipv4.test(host)) return false;
  if (blockedHostSuffixes.some((suffix) => host.endsWith(suffix))) return false;
  return host.includes(".");
}

async function readCapped(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  while (html.length < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    html += decoder.decode(value, { stream: true });
  }
  await reader.cancel().catch(() => undefined);
  // A single chunk can overshoot the cap, so trim rather than trusting the loop bound.
  return html.slice(0, MAX_BYTES);
}

/**
 * Follows a pasted link and returns its markup. Never throws: every expected failure comes
 * back as a typed reason the route turns into an actionable message.
 */
export async function safeFetchPage(raw: string, fetchImpl: typeof fetch = fetch): Promise<PageFetchResult> {
  if (!isImportableUrl(raw)) return { ok: false, reason: "invalid-url" };

  let target = raw;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const response = await fetchImpl(target, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
        cache: "no-store",
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return { ok: false, reason: "unreachable" };
        // A public host redirecting to a private one is the classic bypass: re-check every hop.
        const next = new URL(location, target).toString();
        if (!isImportableUrl(next)) return { ok: false, reason: "blocked" };
        target = next;
        continue;
      }

      if (response.status === 401 || response.status === 403 || response.status === 429 || response.status === 451) return { ok: false, reason: "blocked" };
      if (!response.ok) return { ok: false, reason: "unreachable" };

      const contentType = response.headers.get("content-type") || "";
      if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) return { ok: false, reason: "not-html" };

      const html = await readCapped(response);
      return html ? { ok: true, html, finalUrl: target } : { ok: false, reason: "unreachable" };
    }
    return { ok: false, reason: "unreachable" };
  } catch {
    return { ok: false, reason: "unreachable" };
  } finally {
    clearTimeout(timeout);
  }
}
