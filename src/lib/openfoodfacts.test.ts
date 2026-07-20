import { describe, expect, it, vi } from "vitest";
import { searchOpenFoodFacts } from "./openfoodfacts";

describe("searchOpenFoodFacts", () => {
  it("keeps zero-calorie packaged drinks and requests a useful result set", async () => {
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
    expect(fetchMock.mock.calls[0][0]).toContain("page_size=50");
  });
});
