import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("photo library inputs", () => {
  it("does not hint that photo-library actions should open the camera", async () => {
    const [labelReader, foodCapture, imageHelper, diaryTools, planView] = await Promise.all([
      readFile(new URL("./components/LabelReader.tsx", import.meta.url), "utf8"),
      readFile(new URL("./FoodCapture.tsx", import.meta.url), "utf8"),
      readFile(new URL("../../lib/image.ts", import.meta.url), "utf8"),
      readFile(new URL("../diary/components/DiaryTools.tsx", import.meta.url), "utf8"),
      readFile(new URL("../planning/PlanView.tsx", import.meta.url), "utf8"),
    ]);

    expect(labelReader).toContain("Choose photo");
    expect(foodCapture).toContain("Add photos");
    expect(foodCapture).not.toContain(">Take photo</button>");
    expect(foodCapture).not.toContain('id="coach-intake" autoFocus');
    expect(`${labelReader}\n${foodCapture}`).not.toContain('capture="environment"');
    expect(imageHelper).toContain("MAX_FOOD_IMAGE_DATA_URL_LENGTH = 360_000");
    expect(imageHelper).toContain("IMAGE_DIMENSIONS = [1024, 896, 768, 640]");
    expect(imageHelper).not.toContain("still too large after resizing");
    expect(`${diaryTools}\n${planView}`).toContain("Optional · 1 photo");
    expect(`${diaryTools}\n${planView}`).not.toContain("Optional · up to 8");
  });
});
