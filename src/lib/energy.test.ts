import { describe, expect, it } from "vitest";
import { calculateCalories, calorieFloorFor, describeCustomTarget, effectiveCalorieTarget, estimateGoalEta, resolveCalorieTarget, weeklyRateFor } from "./energy";

const male = { sex: "male" as const, age: 29, heightCm: 191, weightKg: 84, activity: "moderate" as const };
/** The profile that produced the 2,125 kcal target this rework started from. */
const originalReport = { sex: "male" as const, age: 30, heightCm: 175, weightKg: 72, activity: "moderate" as const, goalMode: "lose" as const };
/** Small enough that an aggressive cut runs into the safety floor. */
const smallWoman = { sex: "female" as const, age: 30, heightCm: 160, weightKg: 55, activity: "sedentary" as const, goalMode: "lose" as const };

describe("energy targets", () => {
  it("calculates the user's maintenance target", () => {
    expect(calculateCalories({ ...male, goalMode: "maintain" })).toBe(2925);
  });

  it("adjusts the calorie deficit and surplus by pace", () => {
    expect(calculateCalories({ ...male, goalMode: "lose" })).toBe(calculateCalories({ ...male, goalMode: "lose", goalPace: "moderate" }));
    expect(calculateCalories({ ...male, goalMode: "lose", goalPace: "conservative" })).toBeGreaterThan(calculateCalories({ ...male, goalMode: "lose", goalPace: "moderate" }));
    expect(calculateCalories({ ...male, goalMode: "lose", goalPace: "aggressive" })).toBeLessThan(calculateCalories({ ...male, goalMode: "lose", goalPace: "moderate" }));
    expect(calculateCalories({ ...male, goalMode: "gain", goalPace: "aggressive" })).toBeGreaterThan(calculateCalories({ ...male, goalMode: "gain", goalPace: "conservative" }));
  });

  it("rounds the calorie target to a custom step", () => {
    const base = { ...male, goalMode: "maintain" as const };
    expect(calculateCalories(base, 10) % 10).toBe(0);
    expect(calculateCalories(base, 50) % 50).toBe(0);
  });

  it("scales the deficit with bodyweight rather than applying a flat step", () => {
    const light = resolveCalorieTarget({ ...originalReport, weightKg: 60 });
    const heavy = resolveCalorieTarget({ ...originalReport, weightKg: 110 });
    expect(Math.abs(heavy.dailyDelta)).toBeGreaterThan(Math.abs(light.dailyDelta));
    // What the model actually guarantees: one pace means one *rate of bodyweight change* at any
    // size. A flat calorie step gave the heavier user roughly half the relative rate.
    expect(light.weeklyRateKg / 60).toBeCloseTo(heavy.weeklyRateKg / 110, 6);
  });

  it("resolves the reported profile's paces to the reviewed numbers", () => {
    const paces = (["conservative", "moderate", "aggressive"] as const).map((goalPace) => resolveCalorieTarget({ ...originalReport, goalPace }).target);
    expect(paces).toEqual([2400, 2200, 2000]);
  });

  it("holds a small user's aggressive cut at the floor and says so", () => {
    const result = resolveCalorieTarget({ ...smallWoman, goalPace: "aggressive" });
    expect(result.clamp.kind).toBe("floor");
    if (result.clamp.kind !== "floor") throw new Error("expected a floor clamp");
    expect(result.clamp.requested).toBeLessThan(result.target);
    expect(result.target).toBeGreaterThanOrEqual(calorieFloorFor(smallWoman));
  });

  it("leaves a sensible pace unclamped", () => {
    expect(resolveCalorieTarget({ ...originalReport, goalPace: "moderate" }).clamp.kind).toBe("none");
  });

  it("never recommends eating below resting burn", () => {
    expect(calorieFloorFor(smallWoman)).toBeGreaterThanOrEqual(1200);
    expect(calorieFloorFor(male)).toBeGreaterThanOrEqual(1500);
  });

  it("prefers an accepted observed maintenance over the formula", () => {
    const formula = resolveCalorieTarget({ ...originalReport, goalPace: "moderate" });
    const observed = resolveCalorieTarget({ ...originalReport, goalPace: "moderate", maintenanceSource: "observed", observedMaintenanceKcal: 2300 });
    expect(observed.maintenanceSource).toBe("observed");
    expect(observed.maintenance).toBe(2300);
    expect(observed.target).toBeLessThan(formula.target);
  });

  it("ignores an observed maintenance the user has not switched to", () => {
    const result = resolveCalorieTarget({ ...originalReport, observedMaintenanceKcal: 2300 });
    expect(result.maintenanceSource).toBe("formula");
  });

  it("reports the weekly rate a pace implies, signed by direction", () => {
    expect(weeklyRateFor({ ...originalReport, goalPace: "moderate" })).toBeCloseTo(-0.36, 2);
    expect(weeklyRateFor({ weightKg: 72, goalMode: "gain", goalPace: "moderate" })).toBeCloseTo(0.18, 2);
    expect(weeklyRateFor({ weightKg: 72, goalMode: "maintain" })).toBe(0);
  });

  it("projects a goal weight into weeks and a date", () => {
    const eta = estimateGoalEta({ ...originalReport, goalPace: "moderate", goalWeightKg: 66 }, new Date("2026-08-08T12:00:00"));
    expect(eta.status).toBe("ready");
    if (eta.status !== "ready") throw new Error("expected a projection");
    expect(eta.weeks).toBeGreaterThan(16);
    expect(eta.weeks).toBeLessThan(17);
    expect(eta.date.getTime()).toBeGreaterThan(new Date("2026-11-25T12:00:00").getTime());
  });

  it("rejects a goal weight that contradicts the goal instead of projecting nonsense", () => {
    expect(estimateGoalEta({ ...originalReport, goalWeightKg: 80 }).status).toBe("wrong-direction");
    expect(estimateGoalEta({ weightKg: 72, goalMode: "gain", goalWeightKg: 66 }).status).toBe("wrong-direction");
    expect(estimateGoalEta({ ...originalReport, goalWeightKg: 72 }).status).toBe("reached");
    expect(estimateGoalEta(originalReport).status).toBe("none");
  });

  it("describes a hand-typed target against the same model", () => {
    const insight = describeCustomTarget({ ...originalReport, goalPace: "moderate" }, 1800);
    expect(Math.round(insight.deltaPercent)).toBe(-30);
    expect(insight.weeklyRateKg).toBeCloseTo(-0.72, 2);
    expect(insight.steeperThanAggressive).toBe(true);
    // Above the floor, so it is allowed — annotated, not blocked.
    expect(insight.belowFloor).toBe(false);
  });

  it("flags a hand-typed target below the floor", () => {
    const insight = describeCustomTarget({ ...originalReport, goalPace: "moderate" }, 1500);
    expect(insight.belowFloor).toBe(true);
    expect(insight.suggestedFloorTarget).toBeGreaterThan(1500);
  });

  it("treats a custom target as authoritative and a calculated one as derived", () => {
    const base = { ...originalReport, goalPace: "moderate" as const, calorieTarget: 1800, calorieRoundingStep: 25 as const };
    expect(effectiveCalorieTarget({ ...base, calorieTargetMode: "custom" })).toBe(1800);
    expect(effectiveCalorieTarget({ ...base, calorieTargetMode: "calculated" })).toBe(2200);
  });
});
