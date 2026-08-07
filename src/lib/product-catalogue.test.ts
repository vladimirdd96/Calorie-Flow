import { describe, expect, it } from "vitest";
import { findCatalogueProduct, normalizeBarcode, parseCatalogueRow, searchCatalogue } from "./product-catalogue";

const row = {
  barcode: "4056489814795",
  name: "High Protein Quark Dessert",
  brand: "Pilos",
  quantity_label: "200 g",
  serving_label: "200 g",
  // PostgREST renders `numeric` columns as strings.
  serving_grams: "200",
  package_grams: "200",
  image_url: "https://images.openfoodfacts.org/front_small.jpg",
  nutrients_per_100: { calories: 74, protein: 10, carbs: 4, fat: 1.9, fiber: 0, sugar: 3.5 },
  keywords: ["Кварк десерт"],
  source: "open-food-facts",
  source_ref: "4056489814795",
  countries: ["en:bulgaria", "en:germany"],
  verified: false,
};

describe("normalizeBarcode", () => {
  it("keeps only digits so a hand-typed or hyphenated code still resolves", () => {
    expect(normalizeBarcode(" 4056-489 814795 ")).toBe("4056489814795");
  });
});

describe("parseCatalogueRow", () => {
  it("maps a catalogue row into the shared food model", () => {
    expect(parseCatalogueRow(row)).toEqual({
      id: "catalogue-4056489814795",
      name: "High Protein Quark Dessert",
      brand: "Pilos",
      barcode: "4056489814795",
      imageUrl: "https://images.openfoodfacts.org/front_small.jpg",
      quantityLabel: "200 g",
      servingLabel: "200 g",
      servingGrams: 200,
      packageGrams: 200,
      nutrientsPer100: { calories: 74, protein: 10, carbs: 4, fat: 1.9, fiber: 0, sugar: 3.5 },
      keywords: ["Кварк десерт"],
      source: "open-food-facts",
      verified: undefined,
    });
  });

  it("drops nullable columns rather than surfacing nulls to the UI", () => {
    const sparse = parseCatalogueRow({ ...row, brand: null, image_url: null, serving_grams: null, package_grams: null, keywords: [], source_ref: null, verified: null });
    expect(sparse).toMatchObject({ brand: undefined, imageUrl: undefined, servingGrams: undefined, packageGrams: undefined, keywords: undefined });
  });

  it("rejects a row whose nutrition failed validation", () => {
    expect(parseCatalogueRow({ ...row, nutrients_per_100: { calories: -5 } })).toBeNull();
  });

  it("rejects a barcode that is not 8 to 14 digits", () => {
    expect(parseCatalogueRow({ ...row, barcode: "12345" })).toBeNull();
  });
});

describe("catalogue reads without cloud configuration", () => {
  it("resolves to a miss instead of throwing, so the online providers still run", async () => {
    await expect(findCatalogueProduct("4056489814795")).resolves.toBeNull();
    await expect(findCatalogueProduct("nonsense")).resolves.toBeNull();
    await expect(searchCatalogue("pilos")).resolves.toEqual([]);
  });
});
