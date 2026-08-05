import { humanizeTaxonomyKey } from "../../lib/planning";
import type { PublicRecipe } from "../../lib/types";

export type CatalogueRow = { title: string; items: PublicRecipe[] };

/** Picks a hero without changing catalogue order or requiring another request. */
export function featuredCatalogueRecipe(items: PublicRecipe[]): PublicRecipe | undefined {
  return items.find((item) => item.source === "ai") || items[0];
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
