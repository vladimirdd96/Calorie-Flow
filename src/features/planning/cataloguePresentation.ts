import { humanizeTaxonomyKey } from "../../lib/planning";
import type { PublicRecipe } from "../../lib/types";

export type CatalogueRow = { title: string; items: PublicRecipe[] };

const MS_PER_DAY = 86_400_000;

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

/** Groups the browse rails, omitting the recipe already promoted as the feature. */
export function catalogueBrowseRows(items: PublicRecipe[], featuredId?: string): CatalogueRow[] {
  const byLabel = new Map<string, PublicRecipe[]>();
  for (const item of items) {
    if (item.id === featuredId) continue;
    const label = item.imageCredit?.label || (item.source === "community" ? "Community recipes" : "AI picks");
    const row = byLabel.get(label) || [];
    row.push(item);
    byLabel.set(label, row);
  }
  return [...byLabel.entries()].map(([label, row]) => ({
    title: row[0]?.cuisine ? `${label} · ${humanizeTaxonomyKey(row[0].cuisine)}` : label,
    items: row,
  }));
}
