import { describe, expect, it } from "vitest";
import { gtinVariants, isRestrictedCirculationGtin, isValidGtin, normalizeGtin, toGtin14 } from "./gtin";

describe("isValidGtin", () => {
  it("accepts real check digits at every GTIN length", () => {
    expect(isValidGtin("4056489814795")).toBe(true); // EAN-13, Pilos quark
    expect(isValidGtin("5449000000996")).toBe(true); // EAN-13
    expect(isValidGtin("20961800")).toBe(true); // EAN-8, Lidl in-store code
    expect(isValidGtin("012345678905")).toBe(true); // UPC-A
  });

  it("rejects a misread whose check digit no longer adds up", () => {
    expect(isValidGtin("4056489814796")).toBe(false);
    expect(isValidGtin("5449000000997")).toBe(false);
  });

  it("rejects lengths GS1 does not define", () => {
    expect(isValidGtin("12345")).toBe(false);
    expect(isValidGtin("123456789012345")).toBe(false);
  });
});

describe("gtinVariants", () => {
  it("offers every equivalent spelling of a UPC-A, scanned form first", () => {
    expect(gtinVariants("012345678905")).toEqual([
      "012345678905",
      "0012345678905",
      "00012345678905",
    ]);
  });

  it("treats a zero-padded EAN-13 and its UPC-A as the same product", () => {
    expect(gtinVariants("0012345678905")).toContain("012345678905");
    expect(gtinVariants("012345678905")).toContain("0012345678905");
  });

  it("does not invent shorter forms when every digit is significant", () => {
    expect(gtinVariants("4056489814795")).toEqual(["4056489814795", "04056489814795"]);
  });

  it("strips separators from a hand-typed code", () => {
    expect(gtinVariants(" 4056-489 814795 ")[0]).toBe("4056489814795");
  });
});

describe("isRestrictedCirculationGtin", () => {
  it("flags the in-store codes Lidl and Kaufland assign themselves", () => {
    expect(isRestrictedCirculationGtin("20961800")).toBe(true);
    expect(isRestrictedCirculationGtin("20325251")).toBe(true);
    expect(isRestrictedCirculationGtin("2812345678901")).toBe(true);
  });

  it("leaves ordinary manufacturer codes alone", () => {
    expect(isRestrictedCirculationGtin("4056489814795")).toBe(false);
    expect(isRestrictedCirculationGtin("3800123456789")).toBe(false);
  });
});

describe("normalizeGtin and toGtin14", () => {
  it("keeps digits only and pads to the shared canonical form", () => {
    expect(normalizeGtin("40-56 489814795")).toBe("4056489814795");
    expect(toGtin14("012345678905")).toBe("00012345678905");
    expect(toGtin14("123456789012345")).toBe("");
  });
});
