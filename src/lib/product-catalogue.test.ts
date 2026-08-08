import { describe, expect, it, vi } from "vitest";
import { correctCatalogueProduct, describeUnnamedProduct, findCatalogueProduct, normalizeBarcode, parseCatalogueRow, searchCatalogue } from "./product-catalogue";

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

  it("resolves a batch lookup to a miss without touching the network", async () => {
    await expect(findCatalogueProduct(["4056489814795", "3800123456789"])).resolves.toBeNull();
  });
});

describe("correctCatalogueProduct without cloud configuration", () => {
  it("never throws, since a name correction is always best-effort", async () => {
    await expect(correctCatalogueProduct("4056489814795", "Pilos High Protein Yogurt")).resolves.toBeUndefined();
  });

  it("does nothing for an invalid barcode or a blank name", async () => {
    await expect(correctCatalogueProduct("not-a-barcode", "Anything")).resolves.toBeUndefined();
    await expect(correctCatalogueProduct("4056489814795", "   ")).resolves.toBeUndefined();
  });
});

describe("correctCatalogueProduct routing", () => {
  it("goes through the correcting RPC rather than a raw table update", async () => {
    // The RPC is the only path allowed to touch a row this account did not contribute
    // (a still-unnamed placeholder); a raw `.update()` is scoped by RLS to the owner only
    // and would silently fix nothing for anyone else, which is the bug this guards against.
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    vi.doMock("./supabase", () => ({ getSupabase: () => ({ rpc }) }));
    vi.resetModules();
    const { correctCatalogueProduct: correct } = await import("./product-catalogue");

    await correct(" 4056-489814795 ", "  Pilos High Protein Yogurt  ");

    expect(rpc).toHaveBeenCalledWith("correct_product_catalogue_name", { p_barcode: "4056489814795", p_name: "Pilos High Protein Yogurt" });
    vi.doUnmock("./supabase");
    vi.resetModules();
  });
});

describe("describeUnnamedProduct", () => {
  it("prefers brand and package size when the label gave them", () => {
    expect(describeUnnamedProduct({ brand: "Pilos", quantityLabel: "500 g", barcode: "4056489814795" })).toBe("Pilos 500 g (scanned)");
  });

  it("falls back to the barcode so the row is still identifiable", () => {
    expect(describeUnnamedProduct({ barcode: "4056489814795" })).toBe("Scanned product 4056489814795");
  });

  it("matches the placeholder patterns the database uses to decide who may fix a name", () => {
    // supabase/migrations/202608080001_correctable_placeholder_names.sql derives the
    // `placeholder` column from these exact shapes. A mismatch here would mean a newly
    // saved placeholder silently stops being correctable by anyone but its contributor.
    const placeholderPattern = /\(scanned\)$|^Scanned product [0-9]{8,14}$/;
    expect(describeUnnamedProduct({ barcode: "4056489814795" })).toMatch(placeholderPattern);
    expect(describeUnnamedProduct({ brand: "Pilos", barcode: "4056489814795" })).toMatch(placeholderPattern);
    expect(describeUnnamedProduct({ quantityLabel: "500 g", barcode: "4056489814795" })).toMatch(placeholderPattern);
  });
});
