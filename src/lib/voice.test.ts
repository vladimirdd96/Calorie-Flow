import { describe, expect, it } from "vitest";
import { normalizeVoiceFoodQuery } from "./voice";

describe("voice food input", () => {
  it("normalizes an actionable spoken food phrase", () => {
    expect(normalizeVoiceFoodQuery("  two   eggs and  toast ")).toBe("two eggs and toast");
  });

  it("rejects an empty transcript", () => {
    expect(normalizeVoiceFoodQuery("   ")).toBe("");
  });
});
