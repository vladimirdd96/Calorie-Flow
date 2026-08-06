"use client";

import { ChefHat } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import type { PublicRecipe } from "@/lib/types";
import { featuredCatalogueRecipe, withGeneratedRecipes } from "../cataloguePresentation";
import { useCatalogueRails } from "../hooks/useCatalogueRails";
import { CatalogueRow } from "./CatalogueRow";

/** Rails start fetching this far before they scroll into view, so the strip is populated by the time it lands. */
const RAIL_PREFETCH_MARGIN = "600px";

/**
 * The unfiltered browse surface. Mounted only while no filter is active — unmounting is how the
 * rail claims are reset, so this must not be rendered alongside the filtered grid.
 */
export function CatalogueRails({ generated, hideCalories, onOpen }: {
  generated: PublicRecipe[];
  hideCalories?: boolean;
  onOpen: (item: PublicRecipe) => void;
}) {
  const { rails, loading, error, hasMore, loadMore } = useCatalogueRails();
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = sentinel.current;
    if (!target || !hasMore) return;
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) loadMore(); }, { rootMargin: RAIL_PREFETCH_MARGIN });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const shown = useMemo(() => withGeneratedRecipes(rails, generated), [rails, generated]);
  const featured = useMemo(() => featuredCatalogueRecipe(shown[0]?.items || []), [shown]);

  if (error && !shown.length) return <div className="inline-alert error" role="alert">{error}</div>;
  if (loading && !shown.length) return <div className="catalogue-loading" role="status" aria-label="Loading recipes">{Array.from({ length: 6 }, (_, index) => <i key={index} className="catalogue-skeleton-card" />)}</div>;
  if (!shown.length) return <div className="recipe-empty catalogue-empty card"><span className="action-icon mint"><ChefHat size={22} /></span><strong>The catalogue is still filling up.</strong><p>Share one of your recipes, or refresh your picks to add AI-assisted ideas.</p></div>;

  return <div className="catalogue-rows">
    {shown.map((rail) => <CatalogueRow key={rail.id} title={rail.title} items={rail.items} featuredId={featured?.id} hideCalories={hideCalories} onOpen={onOpen} />)}
    {hasMore && <div ref={sentinel} className="catalogue-rails-sentinel" role="status" aria-label="Loading more recipe rows" />}
    {error && <div className="inline-alert error" role="alert">{error}</div>}
  </div>;
}
