import { describe, expect, it } from "vitest";
import { activeFast, fastingProgress, fastingWindowHours } from "./fasting";

describe("fasting", () => {
  it("finds only an unfinished fast", () => {
    const records = [{ id: "done", startedAt: "2026-07-20T10:00:00.000Z", endedAt: "2026-07-20T22:00:00.000Z" }, { id: "active", startedAt: "2026-07-21T18:00:00.000Z" }];
    expect(activeFast(records)?.id).toBe("active");
  });

  it("limits progress to a completed target", () => {
    expect(fastingProgress("2026-07-21T18:00:00.000Z", "2026-07-22T06:00:00.000Z", 16)).toBe(.75);
    expect(fastingProgress("2026-07-21T18:00:00.000Z", "2026-07-22T18:00:00.000Z", 16)).toBe(1);
  });

  it("reports a completed fasting window in whole minutes", () => {
    expect(fastingWindowHours("2026-07-21T18:00:00.000Z", "2026-07-22T06:30:00.000Z")).toBe(12.5);
  });
});
