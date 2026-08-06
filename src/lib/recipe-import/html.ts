/**
 * Tag-soup helpers for recipe import. The Workers/Node runtimes have no DOM, so
 * everything here is regex over the raw markup — deliberately forgiving, never throwing.
 */

const entities: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", ndash: "–", mdash: "—",
  frac12: "½", frac14: "¼", frac34: "¾", frac13: "⅓", frac23: "⅔", deg: "°", hellip: "…", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”",
};

/** Decodes the named and numeric entities that actually show up in recipe markup. */
export function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => safeCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, digits: string) => safeCodePoint(Number.parseInt(digits, 10)))
    .replace(/&([a-z][a-z0-9]*);/gi, (match, name: string) => entities[name.toLowerCase()] ?? match);
}

function safeCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 1 || code > 0x10ffff) return "";
  try { return String.fromCodePoint(code); } catch { return ""; }
}

export type MetaTags = { title?: string; imageUrl?: string; siteName?: string; description?: string };

function metaContent(html: string, property: string): string | undefined {
  const pattern = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]*>`, "i");
  const tag = html.match(pattern)?.[0];
  const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  const value = content ? decodeEntities(content).trim() : "";
  return value || undefined;
}

/** Reads the Open Graph tags shared by recipe import and catalogue generation. */
export function extractMetaTags(html: string): MetaTags {
  const imageUrl = metaContent(html, "og:image");
  return {
    title: metaContent(html, "og:title"),
    imageUrl: imageUrl && /^https:\/\//i.test(imageUrl) ? imageUrl : undefined,
    siteName: metaContent(html, "og:site_name"),
    description: metaContent(html, "og:description") || metaContent(html, "description"),
  };
}

/** Hostname without a "www." prefix, for display credit. Returns undefined for an unparseable URL. */
export function siteNameFromUrl(url: string): string | undefined {
  try { return new URL(url).hostname.replace(/^www\./i, "") || undefined; } catch { return undefined; }
}

const strippedBlocks = /<(script|style|noscript|template|svg|nav|header|footer|form|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi;
const blockBoundary = /<\/(p|div|li|tr|h[1-6]|section|article|br)\s*>|<br\s*\/?>/gi;

export const MAX_TEXT_CHARS = 12_000;

/**
 * Flattens a page into readable text for AI extraction: drops non-content blocks,
 * keeps block boundaries as newlines so ingredient lists stay one-per-line, and caps length.
 */
export function htmlToText(html: string, maxChars = MAX_TEXT_CHARS): string {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(strippedBlocks, " ")
    .replace(blockBoundary, "\n")
    .replace(/<[^>]*>/g, " ");
  return decodeEntities(text)
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxChars);
}

/** Collapses a fragment of markup into a single trimmed line of text. */
export function tagTextToLine(fragment: string): string {
  return decodeEntities(fragment.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}
