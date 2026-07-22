import { describe, expect, it } from "vitest";
import { produceFoods } from "./produce";

describe("produce reference foods", () => {
  it("contains a broad fruit and vegetable catalogue with usable serving data", () => {
    expect(produceFoods.length).toBeGreaterThan(60);
    expect(produceFoods.map((food) => food.name)).toEqual(expect.arrayContaining(["Apple", "Mango", "Broccoli", "Carrot", "Spinach", "Tomato", "Zucchini"]));
    expect(produceFoods.every((food) => food.source === "seed" && food.servingGrams && food.nutrientsPer100.calories >= 0)).toBe(true);
  });
});
