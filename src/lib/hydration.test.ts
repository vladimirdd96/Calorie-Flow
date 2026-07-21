import { describe, expect, it } from "vitest";
import { hydrationTotal, setWaterAmount } from "./hydration";

describe("hydration", () => {
  it("totals only the selected local day", () => {
    expect(hydrationTotal([{ date: "2026-07-20", amountMl: 600 }, { date: "2026-07-21", amountMl: 350 }], "2026-07-20")).toBe(600);
  });

  it("replaces a day's amount and removes an emptied entry", () => {
    const entries = [{ date: "2026-07-20", amountMl: 600 }];
    expect(setWaterAmount(entries, "2026-07-20", 900)).toEqual([{ date: "2026-07-20", amountMl: 900 }]);
    expect(setWaterAmount(entries, "2026-07-20", 0)).toEqual([]);
  });
});
