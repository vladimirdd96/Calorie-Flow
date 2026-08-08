import { describe, expect, it } from "vitest";
import { buildLabelFood, describeUnnamedProduct, type LabelAnalysis } from "./components/LabelReader";
import type { Food } from "@/lib/types";

const per100 = { calories: 74, protein: 10, carbs: 4, fat: 1.9, fiber: 0, sugar: 3.5 };

function analysis(overrides: Partial<LabelAnalysis> = {}): LabelAnalysis {
  return { productName: null, brand: null, barcode: null, per100, servingSizeG: null, packageSizeG: null, ...overrides };
}

function catalogueFood(overrides: Partial<Food> = {}): Food {
  return {
    id: "catalogue-3800999999998",
    name: "A different yogurt",
    brand: "Someone Else",
    barcode: "3800999999998",
    imageUrl: "https://images.openfoodfacts.org/other-product.jpg",
    quantityLabel: "400 g",
    nutrientsPer100: per100,
    source: "open-food-facts",
    ...overrides,
  };
}

describe("buildLabelFood", () => {
  it("keeps the scanned barcode when the label showed none", () => {
    expect(buildLabelFood(analysis(), "4056489814795").barcode).toBe("4056489814795");
  });

  it("prefers the scanned barcode over one read off the label", () => {
    // The scan is a machine reading of the package in hand; the label OCR is a guess.
    expect(buildLabelFood(analysis({ barcode: "1111111111116" }), "4056489814795").barcode).toBe("4056489814795");
  });

  it("never adopts the barcode of a merely similar product", () => {
    // The regression: a name-similarity match handed over its own barcode, so the scanned
    // code was discarded, the package stayed unfindable, and a mislabelled row was
    // published to the shared catalogue.
    const food = buildLabelFood(analysis({ productName: "High Protein Yogurt" }), "4056489814795", [catalogueFood()]);

    expect(food.barcode).toBe("4056489814795");
    expect(food.name).toBe("High Protein Yogurt");
  });

  it("never borrows the picture of a merely similar product", () => {
    const food = buildLabelFood(analysis({ productName: "High Protein Yogurt" }), "4056489814795", [catalogueFood()]);

    expect(food.imageUrl).toBeUndefined();
    expect(food.quantityLabel).toBeUndefined();
    expect(food.brand).toBeUndefined();
  });

  it("does borrow picture and package wording when the barcode proves it is the same package", () => {
    const same = catalogueFood({ barcode: "4056489814795", name: "Pilos High Protein Yogurt", imageUrl: "https://images.openfoodfacts.org/pilos.jpg" });
    const food = buildLabelFood(analysis(), "4056489814795", [same]);

    expect(food.imageUrl).toBe("https://images.openfoodfacts.org/pilos.jpg");
    expect(food.quantityLabel).toBe("400 g");
    expect(food.name).toBe("Pilos High Protein Yogurt");
  });

  it("leaves the name empty when nothing legible was read, so the user is asked", () => {
    expect(buildLabelFood(analysis(), "4056489814795").name).toBe("");
  });

  it("carries the nutrition the label reader extracted", () => {
    expect(buildLabelFood(analysis({ servingSizeG: 200, packageSizeG: 400 }), "4056489814795")).toMatchObject({
      nutrientsPer100: per100,
      servingGrams: 200,
      packageGrams: 400,
      source: "ai-label",
    });
  });
});

describe("describeUnnamedProduct", () => {
  it("falls back to the barcode so the row is still identifiable", () => {
    expect(describeUnnamedProduct({ ...catalogueFood({ brand: undefined, quantityLabel: undefined }), barcode: "4056489814795" }))
      .toBe("Scanned product 4056489814795");
  });

  it("prefers brand and package size when the label gave them", () => {
    expect(describeUnnamedProduct(catalogueFood({ brand: "Pilos", quantityLabel: "500 g" }))).toBe("Pilos 500 g (scanned)");
  });
});
