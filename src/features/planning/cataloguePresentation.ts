import { humanizeTaxonomyKey } from "../../lib/planning";
import { cuisines, dietaryTags, publicRecipeSources } from "../../lib/types";
import type { DietaryTag, PublicRecipe } from "../../lib/types";

/** One rendered browse rail: a titled, horizontally scrolling strip of recipes. */
export type CatalogueRail = { id: string; title: string; items: PublicRecipe[] };

/** How each rail asks the catalogue for its slice. Every field maps to a `fetchCatalogue` filter. */
export type CatalogueRailQuery = { cuisine?: string; dietary?: DietaryTag[]; source?: "community" | "ai" };

export type CatalogueRailSpec = {
  id: string;
  title: string;
  query: CatalogueRailQuery;
  /** Applied after the fetch for conditions the catalogue query cannot express. */
  filter?: (item: PublicRecipe) => boolean;
};

/** A rail shows at most this many cards, so an early rail cannot drain the catalogue before later ones claim their slice. */
export const RAIL_CAP = 12;
/** Rails below this many unclaimed recipes are dropped rather than rendered half-empty. */
export const RAIL_MIN_ITEMS = 4;

const MS_PER_DAY = 86_400_000;
const FRESH_WINDOW_DAYS = 14;
const FRESH_RAIL_ID = "fresh";
const FRESH_RAIL_TITLE = "Fresh picks";

/** Stable per-day index so the featured pick rotates daily without a server round-trip. */
function dayIndex(now: Date, poolSize: number): number {
  return Math.floor(now.getTime() / MS_PER_DAY) % poolSize;
}

/** Picks a hero without changing catalogue order or requiring another request. Rotates daily among AI recipes (falling back to the full catalogue). */
export function featuredCatalogueRecipe(items: PublicRecipe[], now: Date = new Date()): PublicRecipe | undefined {
  const pool = items.filter((item) => item.source === "ai");
  const candidates = pool.length > 0 ? pool : items;
  if (candidates.length === 0) return undefined;
  return candidates[dayIndex(now, candidates.length)];
}

/**
 * Browse rails in claim order. Each recipe is shown in exactly one rail: the first rail whose
 * query matches it and that still has room. Cuisine precedes dietary because a recipe carries a
 * single cuisine but can carry several dietary tags, so cuisine is the more specific home.
 */
export const catalogueRailSpecs: CatalogueRailSpec[] = [
  {
    id: FRESH_RAIL_ID,
    title: FRESH_RAIL_TITLE,
    query: { source: publicRecipeSources.ai },
    filter: (item) => Date.now() - new Date(item.createdAt).getTime() < FRESH_WINDOW_DAYS * MS_PER_DAY,
  },
  ...Object.values(cuisines).map((cuisine) => ({
    id: `cuisine:${cuisine}`,
    title: humanizeTaxonomyKey(cuisine),
    query: { cuisine },
  })),
  ...Object.values(dietaryTags).map((tag) => ({
    id: `dietary:${tag}`,
    title: humanizeTaxonomyKey(tag),
    query: { dietary: [tag] },
  })),
  { id: "community", title: "From the community", query: { source: publicRecipeSources.community } },
];

/**
 * Narrows a rail's fetched slice to the recipes no earlier rail has taken. Returns an empty list
 * when too little is left to fill a rail, which the caller reads as "drop this rail".
 */
export function claimRailItems(spec: CatalogueRailSpec, fetched: PublicRecipe[], claimed: ReadonlySet<string>): PublicRecipe[] {
  const available: PublicRecipe[] = [];
  for (const item of fetched) {
    if (claimed.has(item.id)) continue;
    if (spec.filter && !spec.filter(item)) continue;
    available.push(item);
    if (available.length === RAIL_CAP) break;
  }
  return available.length >= RAIL_MIN_ITEMS ? available : [];
}

/**
 * Surfaces recipes generated since the rails loaded at the head of the leading rail, without
 * refetching. Recipes a rail already shows are left where they are, so nothing appears twice.
 */
export function withGeneratedRecipes(rails: CatalogueRail[], generated: PublicRecipe[]): CatalogueRail[] {
  if (!generated.length) return rails;
  const shown = new Set(rails.flatMap((rail) => rail.items.map((item) => item.id)));
  const fresh = generated.filter((item) => !shown.has(item.id));
  if (!fresh.length) return rails;
  if (!rails.length) return [{ id: FRESH_RAIL_ID, title: FRESH_RAIL_TITLE, items: fresh }];
  return [{ ...rails[0], items: [...fresh, ...rails[0].items] }, ...rails.slice(1)];
}
