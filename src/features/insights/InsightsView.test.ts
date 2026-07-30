import { describe, expect, it } from "vitest";
import { averageNutritionFor } from "./averageNutrition";

describe("averageNutritionFor", () => {
  it("averages nutrients across logged days instead of summing them", () => {
    const average = averageNutritionFor([
      { calories: 2000, protein: 100, carbs: 200, fat: 80, fiber: 25, sugar: 40 },
      { calories: 1600, protein: 80, carbs: 160, fat: 60, fiber: 15, sugar: 20 },
    ]);

    expect(average).toMatchObject({ calories: 1800, protein: 90, carbs: 180, fat: 70, fiber: 20, sugar: 30 });
  });
});
