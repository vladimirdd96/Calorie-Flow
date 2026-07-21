import { describe, expect, it } from "vitest";
import { mealsCsv } from "./reports";

describe("reports", () => {
  it("creates a quoted meal-level CSV report", () => {
    const result = mealsCsv([{ id: "meal-1", name: "Oats, berries", mealType: "breakfast", amount: 1, unit: "serving", grams: 100, nutrition: { calories: 320, protein: 12, carbs: 48, fat: 8, fiber: 10, sugar: 8 }, createdAt: "2026-07-21T08:00:00.000Z", loggedDate: "2026-07-21", source: "custom" }]);
    expect(result).toContain('"Oats, berries"');
    expect(result.split("\n")).toHaveLength(2);
  });
});
