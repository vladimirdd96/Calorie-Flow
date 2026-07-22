import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("photo library inputs", () => {
  it("does not hint that photo-library actions should open the camera", async () => {
    const [labelReader, foodCapture, diaryPrimitives] = await Promise.all([
      readFile(new URL("./components/LabelReader.tsx", import.meta.url), "utf8"),
      readFile(new URL("./FoodCapture.tsx", import.meta.url), "utf8"),
      readFile(new URL("../diary/components/DiaryPrimitives.tsx", import.meta.url), "utf8"),
    ]);

    expect(labelReader).toContain("Choose photo");
    expect(foodCapture).toContain("Add photos");
    expect(foodCapture).not.toContain(">Take photo</button>");
    expect(foodCapture).not.toContain('id="coach-intake" autoFocus');
    expect(`${labelReader}\n${foodCapture}`).not.toContain('capture="environment"');
    expect(diaryPrimitives).toContain("MAX_MEAL_IMAGE_DATA_URL_LENGTH = 360_000");
    expect(diaryPrimitives).toContain("MEAL_IMAGE_DIMENSIONS = [1024, 896, 768, 640]");
    expect(diaryPrimitives).not.toContain("still too large after resizing");
  });
});
