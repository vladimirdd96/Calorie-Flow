import { describe, expect, it } from "vitest";
import { isHabitFeatureEnabled, toggleHabitFeature } from "./habit-settings";

describe("habit visibility settings", () => {
  it("keeps optional habits hidden until a profile enables them", () => {
    expect(isHabitFeatureEnabled(undefined, "water")).toBe(false);
    expect(isHabitFeatureEnabled(undefined, "fasting")).toBe(false);
  });

  it("toggles only the requested habit without changing the other preference", () => {
    const withoutWater = toggleHabitFeature(["water", "fasting"], "water");
    expect(withoutWater).toEqual(["fasting"]);
    expect(toggleHabitFeature(withoutWater, "water")).toEqual(["water", "fasting"]);
  });
});
