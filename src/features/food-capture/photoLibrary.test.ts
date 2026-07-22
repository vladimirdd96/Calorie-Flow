import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("photo library inputs", () => {
  it("does not hint that photo-library actions should open the camera", async () => {
    const [labelReader, foodCapture] = await Promise.all([
      readFile(new URL("./components/LabelReader.tsx", import.meta.url), "utf8"),
      readFile(new URL("./FoodCapture.tsx", import.meta.url), "utf8"),
    ]);

    expect(labelReader).toContain("Choose photo");
    expect(foodCapture).toContain("Add photos");
    expect(`${labelReader}\n${foodCapture}`).not.toContain('capture="environment"');
  });
});
