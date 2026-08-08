import { describe, expect, it } from "vitest";
import { hydrationDayTotals, hydrationTotal, setWaterAmount } from "./hydration";

describe("hydration", () => {
  it("totals only the selected local day", () => {
    expect(hydrationTotal([{ date: "2026-07-20", amountMl: 600 }, { date: "2026-07-21", amountMl: 350 }], "2026-07-20")).toBe(600);
  });

  it("replaces a day's amount and removes an emptied entry", () => {
    const entries = [{ date: "2026-07-20", amountMl: 600 }];
    expect(setWaterAmount(entries, "2026-07-20", 900)).toEqual([{ date: "2026-07-20", amountMl: 900 }]);
    expect(setWaterAmount(entries, "2026-07-20", 0)).toEqual([]);
  });

  it("retains a user-entered hydration amount to two decimals", () => {
    expect(setWaterAmount([], "2026-07-20", 900.126)).toEqual([{ date: "2026-07-20", amountMl: 900.13 }]);
  });

  it("sums every logged day for all-time history", () => {
    expect(hydrationDayTotals([{ date: "2026-07-21", amountMl: 350 }, { date: "2026-07-20", amountMl: 600 }, { date: "2026-07-20", amountMl: 250 }])).toEqual([
      { date: "2026-07-20", amountMl: 850 },
      { date: "2026-07-21", amountMl: 350 },
    ]);
  });

  it("treats malformed legacy stored entries as empty", () => {
    expect(hydrationTotal({} as never, "2026-07-20")).toBe(0);
    expect(hydrationDayTotals({} as never)).toEqual([]);
    expect(hydrationDayTotals([{ date: 4, amountMl: 600 }, { date: "2026-07-20", amountMl: Number.NaN }] as never)).toEqual([]);
    expect(setWaterAmount({} as never, "2026-07-20", 900)).toEqual([{ date: "2026-07-20", amountMl: 900 }]);
  });
});
