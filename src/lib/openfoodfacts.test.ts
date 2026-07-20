import { describe, expect, it, vi } from "vitest";
import { searchOpenFoodFacts } from "./openfoodfacts";

describe("searchOpenFoodFacts", () => {
  it("keeps zero-calorie packaged drinks and uses the resilient app search endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        products: [{
          code: "5449000000996",
          product_name: "Zero cola",
          brands: "Example Drinks",
          quantity: "500 ml",
          product_quantity: 500,
          nutriments: {
            "energy-kcal_100g": 0,
            proteins_100g: 0,
            carbohydrates_100g: 0,
            fat_100g: 0,
            sugars_100g: 0,
          },
        }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const foods = await searchOpenFoodFacts("zero cola");

    expect(foods).toEqual([expect.objectContaining({
      id: "off-5449000000996",
      name: "Zero cola",
      packageGrams: 500,
      nutrientsPer100: expect.objectContaining({ calories: 0 }),
    })]);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/food-search?q=zero%20cola");
  });

  it("maps USDA FoodData Central branded results into the shared food model", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ products: [{
        _source: "food-data-central",
        fdcId: 123,
        description: "Protein Bar, Chocolate",
        brandOwner: "Example Foods",
        gtinUpc: "3801234567890",
        foodNutrients: [
          { nutrientId: 1008, value: 410 },
          { nutrientId: 1003, value: 20 },
          { nutrientId: 1005, value: 35 },
          { nutrientId: 1004, value: 15 },
        ],
      }] }),
    }));

    const foods = await searchOpenFoodFacts("protein bar");

    expect(foods[0]).toEqual(expect.objectContaining({
      id: "fdc-123",
      source: "food-data-central",
      nutrientsPer100: expect.objectContaining({ calories: 410, protein: 20 }),
    }));
  });
});
