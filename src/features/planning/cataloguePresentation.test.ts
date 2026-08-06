import { describe, expect, it } from "vitest";
import { RAIL_CAP, RAIL_MIN_ITEMS, catalogueRailSpecs, claimRailItems, featuredCatalogueRecipe, withGeneratedRecipes } from "./cataloguePresentation";
import type { PublicRecipe } from "../../lib/types";

const recipe = (id: string, source: PublicRecipe["source"], createdAt = "2026-08-05T12:00:00.000Z"): PublicRecipe => ({
  id, source, name: id, servings: 2, servingGrams: 250, ingredients: [], instructions: [], dietaryTags: [],
  nutritionPerServing: { calories: 400, protein: 20, carbs: 40, fat: 15, fiber: 8, sugar: 5 }, createdAt,
});

const spec = catalogueRailSpecs.find((entry) => entry.id === "cuisine:indian")!;
const many = (count: number) => Array.from({ length: count }, (_, index) => recipe(`r${index}`, "ai"));

describe("catalogue presentation", () => {
  it("prefers an AI recipe for the feature", () => {
    expect(featuredCatalogueRecipe([recipe("community", "community"), recipe("ai", "ai")])?.id).toBe("ai");
  });

  it("falls back to the first community recipe and handles an empty catalogue", () => {
    expect(featuredCatalogueRecipe([recipe("community", "community")])?.id).toBe("community");
    expect(featuredCatalogueRecipe([])).toBeUndefined();
  });

  it("caps a rail so later rails still have recipes to claim", () => {
    expect(claimRailItems(spec, many(RAIL_CAP + 20), new Set())).toHaveLength(RAIL_CAP);
  });

  it("never repeats a recipe an earlier rail already claimed", () => {
    const items = many(RAIL_CAP + 5);
    const claimed = new Set(items.slice(0, 3).map((item) => item.id));
    const result = claimRailItems(spec, items, claimed);
    expect(result.some((item) => claimed.has(item.id))).toBe(false);
    expect(result).toHaveLength(RAIL_CAP);
  });

  it("drops a rail that cannot be filled past the minimum", () => {
    expect(claimRailItems(spec, many(RAIL_MIN_ITEMS - 1), new Set())).toEqual([]);
  });

  it("applies the fresh rail's recency window", () => {
    const fresh = catalogueRailSpecs.find((entry) => entry.id === "fresh")!;
    const recent = Array.from({ length: RAIL_MIN_ITEMS }, (_, index) => recipe(`new${index}`, "ai", new Date().toISOString()));
    const stale = many(RAIL_CAP).map((item) => ({ ...item, createdAt: "2020-01-01T00:00:00.000Z" }));
    expect(claimRailItems(fresh, [...stale, ...recent], new Set()).map((item) => item.id)).toEqual(recent.map((item) => item.id));
  });

  it("puts generated recipes at the head of the leading rail", () => {
    const rails = [{ id: "cuisine:indian", title: "Indian", items: [recipe("a", "ai")] }, { id: "community", title: "From the community", items: [recipe("b", "community")] }];
    const merged = withGeneratedRecipes(rails, [recipe("new", "ai")]);
    expect(merged[0].items.map((item) => item.id)).toEqual(["new", "a"]);
    expect(merged[1]).toBe(rails[1]);
  });

  it("does not re-add a generated recipe a rail already shows", () => {
    const rails = [{ id: "cuisine:indian", title: "Indian", items: [recipe("a", "ai")] }];
    expect(withGeneratedRecipes(rails, [recipe("a", "ai")])).toBe(rails);
  });

  it("creates a rail for generated recipes when the catalogue was empty", () => {
    expect(withGeneratedRecipes([], [recipe("new", "ai")])).toEqual([{ id: "fresh", title: "Fresh picks", items: [recipe("new", "ai")] }]);
  });

  it("gives every rail a unique id", () => {
    expect(new Set(catalogueRailSpecs.map((entry) => entry.id)).size).toBe(catalogueRailSpecs.length);
  });
});
