"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchCatalogue } from "@/lib/cloud";
import { RAIL_CAP, catalogueRailSpecs, claimRailItems } from "../cataloguePresentation";
import type { CatalogueRail } from "../cataloguePresentation";

/** Rails fetch more than they can show so the cap still fills after earlier rails have claimed their overlap. */
const RAIL_FETCH_LIMIT = RAIL_CAP * 4;
/** Rails load a batch at a time: claim order must follow spec order, so a batch only starts once the previous one has claimed. */
const RAIL_BATCH_SIZE = 6;

export type CatalogueRailsState = {
  rails: CatalogueRail[];
  loading: boolean;
  error: string;
  /** True while more rail specs remain to be fetched. */
  hasMore: boolean;
  loadMore: () => void;
};

/**
 * Loads the browse rails lazily, in batches, keeping the "one recipe, one rail" rule: a rail only
 * takes recipes no earlier rail claimed. Batches load in spec order, so a rail always sees every
 * claim made above it. Owning component unmounts to reset — there is no in-place restart.
 */
export function useCatalogueRails(): CatalogueRailsState {
  const [rails, setRails] = useState<CatalogueRail[]>([]);
  const [loadedSpecs, setLoadedSpecs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const claimed = useRef(new Set<string>());
  const inFlight = useRef(false);
  const mounted = useRef(true);

  // Set on the way in as well as cleared on the way out: a remount (React's development
  // double-invoke) must not leave the flag false and discard every result that follows.
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const loadBatch = useCallback(async (start: number) => {
    if (inFlight.current || start >= catalogueRailSpecs.length) return;
    inFlight.current = true;
    setLoading(true); setError("");
    const specs = catalogueRailSpecs.slice(start, start + RAIL_BATCH_SIZE);
    try {
      const results = await Promise.all(specs.map((spec) => fetchCatalogue({ ...spec.query, limit: RAIL_FETCH_LIMIT })));
      if (!mounted.current) return;
      const next: CatalogueRail[] = [];
      specs.forEach((spec, index) => {
        const items = claimRailItems(spec, results[index], claimed.current);
        if (!items.length) return;
        for (const item of items) claimed.current.add(item.id);
        next.push({ id: spec.id, title: spec.title, items });
      });
      setRails((current) => [...current, ...next]);
      setLoadedSpecs(start + specs.length);
    } catch {
      if (mounted.current) setError("Couldn't load the catalogue right now.");
    } finally {
      inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void loadBatch(0); }, [loadBatch]);

  const loadMore = useCallback(() => { void loadBatch(loadedSpecs); }, [loadBatch, loadedSpecs]);

  return { rails, loading, error, hasMore: loadedSpecs < catalogueRailSpecs.length, loadMore };
}
