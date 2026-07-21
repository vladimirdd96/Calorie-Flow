import { describe, expect, it } from "vitest";
import { recentLogDates } from "./logging";

describe("multi-day logging", () => {
  it("returns a bounded set of dates ending today", () => {
    expect(recentLogDates(new Date(2026, 6, 22), 3)).toEqual(["2026-07-22", "2026-07-21", "2026-07-20"]);
  });
});
