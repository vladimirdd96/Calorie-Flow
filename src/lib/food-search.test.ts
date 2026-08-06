import { describe, expect, it } from "vitest";
import { foodMatchesQuery, foodSearchText } from "./food-search";
import type { Food } from "./types";

const food: Food = {
  id: "seed-shopska-salad",
  name: "Shopska salad",
  keywords: ["шопска салата", "shopska salata"],
  servingGrams: 250,
  nutrientsPer100: { calories: 85, protein: 3.2, carbs: 4.6, fat: 6.2, fiber: 1.4, sugar: 3.4 },
  source: "seed",
};

describe("food search matching", () => {
  it("matches the displayed name, the brand, the barcode and hidden keywords", () => {
    expect(foodMatchesQuery(food, "shopska")).toBe(true);
    expect(foodMatchesQuery(food, "шопска")).toBe(true);
    expect(foodMatchesQuery(food, "salata")).toBe(true);
    expect(foodMatchesQuery({ ...food, brand: "Deli", barcode: "3800123456789" }, "3800123")).toBe(true);
    expect(foodMatchesQuery({ ...food, brand: "Deli" }, "deli")).toBe(true);
  });

  it("does not match an unrelated query or an empty one", () => {
    expect(foodMatchesQuery(food, "mojito")).toBe(false);
    expect(foodMatchesQuery(food, "")).toBe(false);
  });

  it("keeps foods without keywords searchable", () => {
    const { keywords, ...withoutKeywords } = food;
    expect(keywords).toHaveLength(2);
    expect(foodSearchText(withoutKeywords)).toBe("shopska salad");
    expect(foodMatchesQuery(withoutKeywords, "shopska")).toBe(true);
  });
});
