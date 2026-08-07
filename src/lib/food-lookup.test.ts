import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Food } from "./types";

const findCatalogueProduct = vi.fn<(barcode: string) => Promise<Food | null>>();
const searchCatalogue = vi.fn<(query: string) => Promise<Food[]>>();
const contributeCatalogueProduct = vi.fn();
const findByBarcode = vi.fn<(barcode: string) => Promise<Food | null>>();
const searchOpenFoodFacts = vi.fn<(query: string) => Promise<Food[]>>();

vi.mock("./product-catalogue", async (importOriginal) => ({
  ...await importOriginal<typeof import("./product-catalogue")>(),
  findCatalogueProduct: (barcode: string) => findCatalogueProduct(barcode),
  searchCatalogue: (query: string) => searchCatalogue(query),
  contributeCatalogueProduct: (contribution: unknown) => contributeCatalogueProduct(contribution),
}));

vi.mock("./openfoodfacts", () => ({
  findByBarcode: (barcode: string) => findByBarcode(barcode),
  searchOpenFoodFacts: (query: string) => searchOpenFoodFacts(query),
}));

const { lookupBarcode, searchPackagedFoods, shareResolvedProduct } = await import("./food-lookup");

function food(overrides: Partial<Food> = {}): Food {
  return {
    id: "catalogue-4056489814795",
    name: "High Protein Yogurt",
    barcode: "4056489814795",
    nutrientsPer100: { calories: 74, protein: 10, carbs: 4, fat: 1.9, fiber: 0, sugar: 3.5 },
    source: "open-food-facts",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  findCatalogueProduct.mockResolvedValue(null);
  searchCatalogue.mockResolvedValue([]);
  findByBarcode.mockResolvedValue(null);
  searchOpenFoodFacts.mockResolvedValue([]);
  contributeCatalogueProduct.mockResolvedValue("published");
});

describe("lookupBarcode", () => {
  it("answers from the shared catalogue without calling the online providers", async () => {
    const shared = food({ source: "ai-label" });
    findCatalogueProduct.mockResolvedValue(shared);

    await expect(lookupBarcode("4056489814795")).resolves.toEqual({ status: "found", food: shared, from: "catalogue" });
    expect(findByBarcode).not.toHaveBeenCalled();
  });

  it("falls through to the providers when the catalogue has no answer", async () => {
    const remote = food();
    findByBarcode.mockResolvedValue(remote);

    await expect(lookupBarcode("4056489814795")).resolves.toEqual({ status: "found", food: remote, from: "providers" });
  });

  it("normalizes a hand-typed barcode and offers every equivalent GTIN spelling", async () => {
    await lookupBarcode(" 4056-489814795 ");

    expect(findCatalogueProduct).toHaveBeenCalledWith(["4056489814795", "04056489814795"]);
    expect(findByBarcode).toHaveBeenNthCalledWith(1, "4056489814795");
  });

  it("retries the padded spelling when a provider only stores the UPC-A form", async () => {
    const remote = food({ barcode: "012345678905" });
    findByBarcode.mockImplementation(async (barcode) => barcode === "0012345678905" ? remote : null);

    await expect(lookupBarcode("012345678905")).resolves.toEqual({ status: "found", food: remote, from: "providers" });
    expect(findByBarcode).toHaveBeenCalledWith("012345678905");
    expect(findByBarcode).toHaveBeenCalledWith("0012345678905");
  });

  it("separates a genuine miss from an outage so the app can word them differently", async () => {
    await expect(lookupBarcode("4056489814795")).resolves.toEqual({ status: "not-found" });

    findByBarcode.mockRejectedValue(new Error("offline"));
    await expect(lookupBarcode("4056489814795")).resolves.toEqual({ status: "unavailable" });
  });
});

describe("shareResolvedProduct", () => {
  it("publishes a product the user resolved from a label", async () => {
    const scanned = food({ source: "ai-label" });

    await expect(shareResolvedProduct(scanned)).resolves.toBe("published");
    expect(contributeCatalogueProduct).toHaveBeenCalledWith({ food: scanned, source: "ai-label" });
  });

  it("does not republish what a public provider already answered", async () => {
    await expect(shareResolvedProduct(food({ source: "open-food-facts" }))).resolves.toBe("skipped");
    expect(contributeCatalogueProduct).not.toHaveBeenCalled();
  });
});

describe("searchPackagedFoods", () => {
  it("lists catalogue matches first and drops the provider copy of the same barcode", async () => {
    searchCatalogue.mockResolvedValue([food({ id: "catalogue-4056489814795", name: "Pilos High Protein Yogurt" })]);
    searchOpenFoodFacts.mockResolvedValue([
      food({ id: "off-4056489814795", name: "High Protein Yogurt" }),
      food({ id: "off-3800123456789", barcode: "3800123456789", name: "Another yogurt" }),
    ]);

    const results = await searchPackagedFoods("pilos");

    expect(results.map((match) => match.id)).toEqual(["catalogue-4056489814795", "off-3800123456789"]);
  });

  it("still returns catalogue matches when the providers are unreachable", async () => {
    searchCatalogue.mockResolvedValue([food()]);
    searchOpenFoodFacts.mockRejectedValue(new Error("offline"));

    await expect(searchPackagedFoods("pilos")).resolves.toHaveLength(1);
  });

  it("reports the outage only when nothing at all could be shown", async () => {
    searchOpenFoodFacts.mockRejectedValue(new Error("offline"));

    await expect(searchPackagedFoods("pilos")).rejects.toThrow("Packaged food search is unavailable.");
  });
});
