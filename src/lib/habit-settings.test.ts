import { describe, expect, it } from "vitest";
import { isHabitFeatureEnabled, toggleHabitFeature } from "./habit-settings";

describe("habit visibility settings", () => {
  it("keeps water and fasting visible for profiles created before the preference existed", () => {
    expect(isHabitFeatureEnabled(undefined, "water")).toBe(true);
    expect(isHabitFeatureEnabled(undefined, "fasting")).toBe(true);
  });

  it("toggles only the requested habit without changing the other preference", () => {
    const withoutWater = toggleHabitFeature(["water", "fasting"], "water");
    expect(withoutWater).toEqual(["fasting"]);
    expect(toggleHabitFeature(withoutWater, "water")).toEqual(["water", "fasting"]);
  });
});
