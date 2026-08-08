import { decimalString, normalizeDecimalInput, parseDecimal, roundDecimal } from "./decimal";
import { describe, expect, it } from "vitest";

describe("two-decimal measurements", () => {
  it("rounds at the hundredth boundary without floating-point tails", () => {
    expect(roundDecimal(1.234)).toBe(1.23);
    expect(roundDecimal(1.235)).toBe(1.24);
    expect(roundDecimal(0.1 + 0.2)).toBe(0.3);
  });

  it("parses valid numeric drafts without accepting malformed values", () => {
    expect(parseDecimal("12.34")).toBe(12.34);
    expect(parseDecimal("12,34")).toBe(12.34);
    expect(parseDecimal("")).toBeUndefined();
    expect(parseDecimal("not a number")).toBeUndefined();
    expect(normalizeDecimalInput("12,34")).toBe("12.34");
    expect(decimalString(2.345)).toBe("2.35");
  });
});
