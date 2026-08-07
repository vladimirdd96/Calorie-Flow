import { gzipSync } from "node:zlib";
import { beforeEach, describe, expect, it, vi } from "vitest";
// The builder is the other half of this contract: if the two hashes ever diverge, every
// lookup reads the wrong shard and the mirror silently answers nothing.
import { shardIndex as builderShardIndex, SHARD_COUNT } from "../../scripts/catalogue/shard.mjs";
import { toGtin14 } from "./gtin";

const assets: { fetch?: (request: Request) => Promise<Response> } = {};

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => {
    if (!assets.fetch) throw new Error("no Cloudflare context");
    return { env: { ASSETS: { fetch: assets.fetch } } };
  },
}));

const { findMirrorProduct, shardIndex, shardKey } = await import("./product-mirror");

const barcodes = ["4056489814795", "5449000000996", "3800123456789", "20961800", "012345678905"];

/**
 * Stands in for the deployed assets. `encoding` mirrors the two ways a shard can arrive:
 * as the gzip bytes the builder wrote, or already decoded because the asset was served
 * with `content-encoding: gzip`.
 */
function serveShards(shards: Record<string, unknown[]>, encoding: "gzip" | "plain" = "gzip") {
  assets.fetch = async (request: Request) => {
    const path = new URL(request.url).pathname;
    const shard = shards[path];
    if (!shard) return new Response("not found", { status: 404 });
    const json = JSON.stringify(shard);
    return new Response(encoding === "gzip" ? gzipSync(Buffer.from(json)) : json);
  };
}

beforeEach(() => {
  // Module-level shard caching would otherwise leak between cases.
  vi.resetModules();
  delete assets.fetch;
});

describe("shard placement", () => {
  it("agrees with the builder for every GTIN it is given", () => {
    for (const barcode of barcodes) {
      const canonical = toGtin14(barcode);
      expect(shardIndex(canonical)).toBe(builderShardIndex(canonical));
    }
  });

  it("stays inside the shard count", () => {
    for (const barcode of barcodes) {
      const index = shardIndex(toGtin14(barcode));
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(SHARD_COUNT);
    }
  });

  it("sends every equivalent spelling of one GTIN to the same shard", () => {
    // A UPC-A and its zero-padded EAN-13 are the same product and must not split.
    expect(shardKey(toGtin14("012345678905"))).toBe(shardKey(toGtin14("0012345678905")));
    expect(shardKey(toGtin14("012345678905"))).toBe(shardKey(toGtin14("00012345678905")));
  });

  it("builds an asset path under the mirror prefix", () => {
    expect(shardKey(toGtin14("4056489814795"))).toMatch(/^\/catalogue\/p\/[0-9a-f]{3}\.json\.gz$/);
  });
});

describe("findMirrorProduct", () => {
  it("reads a gzipped shard and returns the product in Open Food Facts shape", async () => {
    const canonical = toGtin14("4056489814795");
    serveShards({
      [shardKey(canonical)]: [[
        canonical, "High Protein Quark Dessert", "Pilos", 74, 10, 4, 1.9, 0, 3.5, 200, 200,
        "https://images.openfoodfacts.org/front_small.jpg",
      ]],
    });
    const { findMirrorProduct: find } = await import("./product-mirror");

    await expect(find("4056489814795")).resolves.toEqual({
      // Padding is stripped so the code matches what the scanner read.
      code: "4056489814795",
      product_name: "High Protein Quark Dessert",
      brands: "Pilos",
      serving_quantity: 200,
      product_quantity: 200,
      image_front_small_url: "https://images.openfoodfacts.org/front_small.jpg",
      nutriments: {
        "energy-kcal_100g": 74,
        proteins_100g: 10,
        carbohydrates_100g: 4,
        fat_100g: 1.9,
        fiber_100g: 0,
        sugars_100g: 3.5,
      },
    });
  });

  it("finds a product stored under its padded form when the scanner read the UPC-A", async () => {
    const canonical = toGtin14("012345678905");
    serveShards({ [shardKey(canonical)]: [[canonical, "Padded product", null, 100, 1, 2, 3, 0, 0, null, null, null]] });
    const { findMirrorProduct: find } = await import("./product-mirror");

    await expect(find("012345678905")).resolves.toMatchObject({ product_name: "Padded product" });
    await expect(find("0012345678905")).resolves.toMatchObject({ product_name: "Padded product" });
  });

  it("reads a shard that arrived already decoded", async () => {
    // Cloudflare may serve the asset with `content-encoding: gzip` and have it decoded
    // before the Worker sees it; assuming gzip would then fail every single lookup.
    const canonical = toGtin14("4056489814795");
    serveShards({ [shardKey(canonical)]: [[canonical, "Plain JSON shard", null, 74, 10, 4, 1.9, 0, 3.5, null, null, null]] }, "plain");
    const { findMirrorProduct: find } = await import("./product-mirror");

    await expect(find("4056489814795")).resolves.toMatchObject({ product_name: "Plain JSON shard" });
  });

  it("returns a miss for a barcode the shard does not hold", async () => {
    serveShards({ [shardKey(toGtin14("4056489814795"))]: [] });
    const { findMirrorProduct: find } = await import("./product-mirror");

    await expect(find("4056489814795")).resolves.toBeNull();
  });

  it("resolves to a miss without a Cloudflare context, so the live providers still answer", async () => {
    await expect(findMirrorProduct("4056489814795")).resolves.toBeNull();
    await expect(findMirrorProduct("not-a-barcode")).resolves.toBeNull();
  });
});
