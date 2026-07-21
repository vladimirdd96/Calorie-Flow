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

  it("maps restaurant menu items into a serving-aware food result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ products: [{
        _source: "restaurant",
        nix_item_id: "cafe-iced-latte",
        food_name: "Iced latte",
        brand_name: "Example Cafe",
        serving_qty: 1,
        serving_unit: "cup",
        serving_weight_grams: 355,
        nf_calories: 190,
        nf_protein: 10,
        nf_total_carbohydrate: 22,
        nf_total_fat: 7,
        nf_dietary_fiber: 0,
        nf_sugars: 20,
        photo: { thumb: "https://images.example.test/latte.jpg" },
      }] }),
    }));

    const foods = await searchOpenFoodFacts("iced latte");

    expect(foods[0]).toEqual(expect.objectContaining({
      id: "restaurant-cafe-iced-latte",
      name: "Iced latte",
      brand: "Example Cafe",
      source: "restaurant",
      servingGrams: 355,
      servingLabel: "1 cup",
      imageUrl: "https://images.example.test/latte.jpg",
      nutrientsPer100: expect.objectContaining({
        calories: expect.closeTo(54),
        protein: expect.closeTo(2.8),
        carbs: expect.closeTo(6.2),
      }),
    }));
  });
});
