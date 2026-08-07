import { describe, expect, it } from "vitest";
import { normalizeProduct, readImageUrl, readNutrition } from "./product.mjs";

/** A record in the migrated export shape (schema_version 1001+). */
function migrated(overrides = {}) {
  return {
    code: "3017620422003",
    product_name: "Nutella",
    brands: "Ferrero,Nutella",
    lang: "en",
    // The migration leaves this present but empty, which is what made the failure silent.
    nutriments: {},
    nutrition: {
      aggregated_set: {
        per: "100g",
        preparation: "as_sold",
        nutrients: {
          "energy-kcal": { unit: "kcal", value: 539, value_computed: 533.3 },
          proteins: { unit: "g", value: 6.3 },
          carbohydrates: { unit: "g", value: 57.5 },
          fat: { unit: "g", value: 30.9 },
          fiber: { unit: "g", value: 3.4 },
          sugars: { unit: "g", value: 56.3 },
          sodium: { unit: "g", value: 0.0428 },
        },
      },
    },
    images: { selected: { front: { en: { rev: "879", imgid: "146" } } } },
    ...overrides,
  };
}

/** A record still carrying the flat pre-migration keys. */
function legacy(overrides = {}) {
  return {
    code: "4056489358770",
    product_name: "Краве масло 82%",
    brands: "Pilos",
    nutriments: {
      "energy-kcal_100g": 744,
      proteins_100g: 0.7,
      carbohydrates_100g: 0.7,
      fat_100g: 82,
      fiber_100g: 0,
      sugars_100g: 0.7,
      sodium_100g: 0.02,
    },
    image_front_small_url: "https://images.openfoodfacts.org/legacy.jpg",
    ...overrides,
  };
}

describe("readNutrition", () => {
  it("reads the migrated schema and prefers the stated value over the computed one", () => {
    const nutrition = readNutrition(migrated());
    // 539 is what the manufacturer stated; 533.3 is derived from the macros.
    expect(nutrition).toMatchObject({ calories: 539, protein: 6.3, carbs: 57.5, fat: 30.9, sugar: 56.3 });
  });

  it("converts a migrated nutrient onto the unit the app stores", () => {
    // Sodium arrives in grams and is stored in milligrams.
    expect(readNutrition(migrated()).micronutrients.sodiumMg).toBe(42.8);
  });

  it("still reads the legacy flat keys", () => {
    expect(readNutrition(legacy())).toMatchObject({ calories: 744, protein: 0.7, fat: 82 });
    expect(readNutrition(legacy()).micronutrients.sodiumMg).toBe(20);
  });

  it("does not treat an empty nutriments object as a product without nutrition", () => {
    // The regression: `nutriments: {}` passed a typeof check, every lookup returned zero,
    // and roughly three quarters of the export was discarded as having no nutrition.
    const record = migrated();
    expect(record.nutriments).toEqual({});
    expect(readNutrition(record)).not.toBeNull();
  });

  it("derives calories from kilojoules when no kcal value is present", () => {
    const record = migrated();
    delete record.nutrition.aggregated_set.nutrients["energy-kcal"];
    record.nutrition.aggregated_set.nutrients["energy-kj"] = { unit: "kJ", value: 418.4 };
    expect(readNutrition(record).calories).toBe(100);
  });

  it("rejects a set that is not stated per 100", () => {
    const record = migrated();
    record.nutrition.aggregated_set.per = "serving";
    expect(readNutrition(record)).toBeNull();
  });

  it("accepts per 100 ml, which the app logs as grams", () => {
    const record = migrated();
    record.nutrition.aggregated_set.per = "100ml";
    expect(readNutrition(record)?.calories).toBe(539);
  });
});

describe("readImageUrl", () => {
  it("rebuilds the thumbnail the migrated export no longer stores", () => {
    expect(readImageUrl(migrated())).toBe(
      "https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.879.200.jpg",
    );
  });

  it("does not split an eight-digit code into path segments", () => {
    const record = migrated({ code: "20961800", images: { selected: { front: { bg: { rev: "4" } } } } });
    expect(readImageUrl(record)).toBe("https://images.openfoodfacts.org/images/products/20961800/front_bg.4.200.jpg");
  });

  it("falls back to the legacy URL field", () => {
    expect(readImageUrl(legacy())).toBe("https://images.openfoodfacts.org/legacy.jpg");
  });
});

describe("normalizeProduct", () => {
  it("returns a uniform record from either schema", () => {
    expect(normalizeProduct(migrated())).toMatchObject({ code: "3017620422003", name: "Nutella", brand: "Ferrero" });
    expect(normalizeProduct(legacy())).toMatchObject({ code: "4056489358770", brand: "Pilos" });
  });

  it("drops products that cannot answer how much was eaten", () => {
    expect(normalizeProduct(migrated({ product_name: "" }))).toBeNull();
    expect(normalizeProduct(migrated({ code: "123" }))).toBeNull();
    const noNutrition = migrated({ nutrition: undefined });
    expect(normalizeProduct(noNutrition)).toBeNull();
  });

  it("keeps local-language names as hidden search terms", () => {
    const record = migrated({ product_name_bg: "Нутела", product_name_en: "Nutella" });
    expect(normalizeProduct(record).keywords).toContain("Нутела");
    expect(normalizeProduct(record).keywords).not.toContain("Nutella");
  });
});
