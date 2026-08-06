import { decodeEntities } from "./html";

/** A recipe as it was published, before any of our own defaults or estimates are applied. */
export type ParsedRecipe = {
  name?: string;
  servings?: number;
  ingredients: string[];
  instructions: string[];
  imageUrl?: string;
  cuisine?: string;
  author?: string;
  description?: string;
  /** Whatever subset of nutrition the page published, per serving. */
  nutrition?: ParsedNutrition;
  /** Grams for one serving, when `nutrition.servingSize` was expressed in grams. */
  servingGrams?: number;
};

export type ParsedNutrition = { calories?: number; protein?: number; carbs?: number; fat?: number; fiber?: number; sugar?: number };

type Node = Record<string, unknown>;

const jsonLdBlock = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

/** Every parseable JSON-LD payload on the page. Malformed blocks are skipped, never fatal. */
export function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  for (const match of html.matchAll(jsonLdBlock)) {
    const raw = decodeEntities(match[1]).replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, "").trim();
    if (!raw) continue;
    try { blocks.push(JSON.parse(raw)); } catch { /* a broken block on the page must not fail the import */ }
  }
  return blocks;
}

function isNode(value: unknown): value is Node {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasType(node: Node, type: string): boolean {
  const declared = node["@type"];
  const values = Array.isArray(declared) ? declared : [declared];
  return values.some((value) => typeof value === "string" && value.toLowerCase() === type.toLowerCase());
}

/** Walks arrays and `@graph` wrappers to find the Recipe node publishers actually emit. */
export function findRecipeNode(blocks: unknown[]): Node | undefined {
  const queue = [...blocks];
  let visited = 0;
  while (queue.length && visited < 500) {
    const current = queue.shift();
    visited += 1;
    if (Array.isArray(current)) { queue.push(...current); continue; }
    if (!isNode(current)) continue;
    if (hasType(current, "Recipe")) return current;
    const graph = current["@graph"];
    if (Array.isArray(graph)) queue.push(...graph);
    else if (isNode(graph)) queue.push(graph);
  }
  return undefined;
}

function text(value: unknown): string | undefined {
  if (typeof value === "string") { const trimmed = decodeEntities(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); return trimmed || undefined; }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) return text(value[0]);
  if (isNode(value)) return text(value.name ?? value.text ?? value.url);
  return undefined;
}

function stringList(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringList);
  if (isNode(value)) { const single = text(value); return single ? [single] : []; }
  return [];
}

/** Reads the leading number out of "4 servings", ["4"], or 4. */
export function parseServings(value: unknown): number | undefined {
  const raw = Array.isArray(value) ? value.map((item) => text(item)).find(Boolean) : text(value);
  const amount = raw?.match(/\d+(?:[.,]\d+)?/)?.[0];
  const servings = amount ? Number(amount.replace(",", ".")) : NaN;
  return Number.isFinite(servings) && servings > 0 && servings <= 100 ? servings : undefined;
}

/** Reads the leading number out of a schema.org measurement such as "320 kcal" or "12 g". */
export function parseMeasurement(value: unknown): number | undefined {
  const raw = text(value);
  const amount = raw?.match(/\d+(?:[.,]\d+)?/)?.[0];
  const parsed = amount ? Number(amount.replace(",", ".")) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/** Flattens `recipeInstructions` across every shape: plain text, HowToStep, and nested HowToSection. */
export function parseInstructions(value: unknown, depth = 0): string[] {
  if (depth > 4) return [];
  if (typeof value === "string") {
    const flattened = decodeEntities(value).replace(/<\/(?:li|p|div)>/gi, "\n").replace(/<[^>]*>/g, " ");
    return flattened.split(/\n+/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  }
  if (Array.isArray(value)) return value.flatMap((item) => parseInstructions(item, depth + 1));
  if (isNode(value)) {
    if (Array.isArray(value.itemListElement) || isNode(value.itemListElement)) return parseInstructions(value.itemListElement, depth + 1);
    const step = text(value.text ?? value.name);
    return step ? [step] : [];
  }
  return [];
}

function parseImage(value: unknown): string | undefined {
  const candidates = Array.isArray(value) ? value : [value];
  for (const candidate of candidates) {
    const url = typeof candidate === "string" ? candidate : isNode(candidate) ? text(candidate.url ?? candidate.contentUrl) : undefined;
    if (url && /^https:\/\//i.test(url)) return url;
  }
  return undefined;
}

function parseNutrition(value: unknown): { nutrition?: ParsedNutrition; servingGrams?: number } {
  if (!isNode(value)) return {};
  const nutrition: ParsedNutrition = {
    calories: parseMeasurement(value.calories),
    protein: parseMeasurement(value.proteinContent),
    carbs: parseMeasurement(value.carbohydrateContent),
    fat: parseMeasurement(value.fatContent),
    fiber: parseMeasurement(value.fiberContent),
    sugar: parseMeasurement(value.sugarContent),
  };
  const servingSize = text(value.servingSize);
  const grams = servingSize && /\b\d+(?:[.,]\d+)?\s*g\b/i.test(servingSize) ? parseMeasurement(servingSize) : undefined;
  return Object.values(nutrition).some((entry) => entry !== undefined) ? { nutrition, servingGrams: grams } : { servingGrams: grams };
}

/** Maps a schema.org Recipe node onto the fields the importer needs. */
export function parseSchemaRecipe(node: Node | undefined): ParsedRecipe | undefined {
  if (!node) return undefined;
  const ingredients = stringList(node.recipeIngredient ?? node.ingredients).map((line) => decodeEntities(line).replace(/\s+/g, " ").trim()).filter(Boolean);
  const instructions = parseInstructions(node.recipeInstructions);
  if (!ingredients.length && !instructions.length) return undefined;
  const { nutrition, servingGrams } = parseNutrition(node.nutrition);
  return {
    name: text(node.name ?? node.headline),
    servings: parseServings(node.recipeYield ?? node.yield),
    ingredients,
    instructions,
    imageUrl: parseImage(node.image ?? node.thumbnailUrl),
    cuisine: text(node.recipeCuisine),
    author: text(node.author),
    description: text(node.description),
    nutrition,
    servingGrams,
  };
}
