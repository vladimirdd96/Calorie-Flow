import { describe, expect, it } from "vitest";
import type { MealPhotoAnalysis, Nutrition } from "@/lib/types";
import { mealFromPhoto, mealPhotoName, mealPhotoTotals, resizeItem, reviewItems, scaleItems } from "./mealPhoto";

const nutrition = (calories: number, protein: number, carbs: number, fat: number): Nutrition => ({ calories, protein, carbs, fat, fiber: 0, sugar: 0 });

const analysis: MealPhotoAnalysis = {
  name: "Chicken, rice and broccoli",
  mealType: "dinner",
  confidence: "medium",
  items: [
    { name: "Grilled chicken breast", portion: "1 medium breast", grams: 150, nutrition: nutrition(248, 46.5, 0, 5.4) },
    { name: "Cooked white rice", portion: "1 cup", grams: 150, nutrition: nutrition(200, 4, 44, 0.4) },
    { name: "Steamed broccoli", portion: "1 cup", grams: 90, nutrition: nutrition(30, 2.5, 6, 0.3) },
  ],
};

describe("mealPhotoTotals", () => {
  it("sums only the items the user kept", () => {
    const items = reviewItems(analysis).map((item, index) => index === 2 ? { ...item, included: false } : item);
    const totals = mealPhotoTotals(items);
    expect(totals.count).toBe(2);
    expect(totals.grams).toBe(300);
    expect(totals.nutrition.calories).toBe(448);
    expect(totals.nutrition.protein).toBe(50.5);
  });

  it("reports an empty meal rather than throwing when everything is excluded", () => {
    const totals = mealPhotoTotals(reviewItems(analysis).map((item) => ({ ...item, included: false })));
    expect(totals).toMatchObject({ count: 0, grams: 0 });
    expect(totals.nutrition.calories).toBe(0);
  });
});

describe("resizeItem", () => {
  it("scales the macros with the corrected weight", () => {
    const [chicken] = reviewItems(analysis);
    const doubled = resizeItem(chicken, 300);
    expect(doubled.grams).toBe(300);
    expect(doubled.nutrition.calories).toBe(496);
    expect(doubled.nutrition.protein).toBe(93);
  });

  it("keeps a weight of at least one gram", () => {
    const [chicken] = reviewItems(analysis);
    expect(resizeItem(chicken, 0).grams).toBe(1);
    expect(resizeItem(chicken, -40).grams).toBe(1);
  });

  it("changes the weight without dividing by zero when the model reported none", () => {
    const resized = resizeItem({ id: "x", included: true, name: "Sauce", portion: "", grams: 0, nutrition: nutrition(90, 0, 2, 9) }, 20);
    expect(resized.grams).toBe(20);
    expect(resized.nutrition.calories).toBe(90);
  });
});

describe("scaleItems", () => {
  it("applies one portion multiplier across every item", () => {
    const scaled = scaleItems(reviewItems(analysis), 0.75);
    expect(scaled.map((item) => item.grams)).toEqual([113, 113, 68]);
    expect(scaled[0].nutrition.calories).toBe(187);
  });
});

describe("mealPhotoName", () => {
  it("prefers the dish name the user can edit", () => {
    expect(mealPhotoName("  Sunday roast  ", reviewItems(analysis))).toBe("Sunday roast");
  });

  it("falls back to the foods left on the plate", () => {
    const items = reviewItems(analysis).map((item, index) => index === 0 ? item : { ...item, included: false });
    expect(mealPhotoName("", items)).toBe("Grilled chicken breast");
  });

  it("never produces an empty diary name", () => {
    expect(mealPhotoName("", [])).toBe("Meal from photo");
  });
});

describe("mealFromPhoto", () => {
  it("builds one estimated diary entry from the reviewed items", () => {
    const meal = mealFromPhoto({ items: reviewItems(analysis), dish: "Chicken, rice and broccoli", mealType: "lunch", loggedDate: "2026-08-01", imageUrl: "data:image/jpeg;base64,abc" });
    expect(meal).toMatchObject({
      name: "Chicken, rice and broccoli",
      mealType: "lunch",
      amount: 1,
      unit: "serving",
      grams: 390,
      loggedDate: "2026-08-01",
      imageUrl: "data:image/jpeg;base64,abc",
      source: "custom",
      estimated: true,
    });
    expect(meal.nutrition.calories).toBe(478);
    expect(meal.id.startsWith("photo-")).toBe(true);
  });

  it("keeps a positive weight even when every item was weightless", () => {
    const meal = mealFromPhoto({ items: [{ id: "a", included: true, name: "Black coffee", portion: "1 cup", grams: 0, nutrition: nutrition(2, 0, 0, 0) }], dish: "", mealType: "snack", loggedDate: "2026-08-01" });
    expect(meal.grams).toBe(1);
  });
});
