import { describe, expect, it } from "vitest";
import { catalogueBrowseRows, featuredCatalogueRecipe } from "./cataloguePresentation";
import type { PublicRecipe } from "../../lib/types";

const recipe = (id: string, source: PublicRecipe["source"]): PublicRecipe => ({
  id, source, name: id, servings: 2, servingGrams: 250, ingredients: [], instructions: [], dietaryTags: [],
  nutritionPerServing: { calories: 400, protein: 20, carbs: 40, fat: 15, fiber: 8, sugar: 5 }, createdAt: "2026-08-05T12:00:00.000Z",
});

describe("catalogue presentation", () => {
  it("prefers an AI recipe for the feature", () => {
    expect(featuredCatalogueRecipe([recipe("community", "community"), recipe("ai", "ai")])?.id).toBe("ai");
  });

  it("falls back to the first community recipe and handles an empty catalogue", () => {
    expect(featuredCatalogueRecipe([recipe("community", "community")])?.id).toBe("community");
    expect(featuredCatalogueRecipe([])).toBeUndefined();
  });

  it("omits the promoted recipe from browse rails", () => {
    const community = recipe("community", "community");
    expect(catalogueBrowseRows([recipe("ai", "ai"), community], "ai")).toEqual([{ title: "Community recipes", items: [community] }]);
  });
});
