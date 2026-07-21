import { describe, expect, it } from "vitest";
import { prepareDiaryShareInvite } from "./diary-sharing";

describe("prepareDiaryShareInvite", () => {
  it("normalizes a recipient email before it is stored in a share", () => {
    expect(prepareDiaryShareInvite("  Friend@Example.com ", "owner@example.com")).toBe("friend@example.com");
  });

  it("rejects an invalid or self-addressed invitation", () => {
    expect(() => prepareDiaryShareInvite("not-an-email", "owner@example.com")).toThrow("Enter a valid email address.");
    expect(() => prepareDiaryShareInvite("owner@example.com", "owner@example.com")).toThrow("Choose someone else to share with.");
  });
});
