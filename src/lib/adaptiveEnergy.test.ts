import { describe, expect, it } from "vitest";
import { blendedMaintenance, customTargetAdherence, maintenanceDiffersEnough, observedMaintenance } from "./adaptiveEnergy";
import { dateKeyWindow } from "./mealDays";
import type { Meal, WeightEntry } from "./types";

const today = new Date("2026-08-08T12:00:00");

function dayMeal(date: string, calories: number): Meal {
  return {
    id: `${date}-meal`,
    name: "Logged day",
    mealType: "lunch",
    amount: 1,
    unit: "serving",
    grams: 500,
    nutrition: { calories, protein: 100, carbs: 200, fat: 60, fiber: 20, sugar: 30 },
    createdAt: `${date}T12:00:00.000Z`,
    loggedDate: date,
    source: "custom",
  };
}

const mealsOf = (days: number, calories: number) => dateKeyWindow(days, today).map((date) => dayMeal(date, calories));

/** One weigh-in every other day, trending down at a steady `kgPerDay`. */
function weighIns(days: number, startKg: number, kgPerDay: number): WeightEntry[] {
  return dateKeyWindow(days, today)
    .map((date, index) => ({ date, weightKg: startKg + kgPerDay * index }))
    .filter((_, index) => index % 2 === 0);
}

describe("adaptive energy", () => {
  it("refuses to estimate maintenance without enough logged days", () => {
    const result = observedMaintenance(mealsOf(6, 2000), { calorieTarget: 2000, weightEntries: weighIns(28, 80, -0.05) }, today);
    expect(result.status).toBe("insufficient");
    if (result.status !== "insufficient") throw new Error("expected insufficient");
    expect(result.needsDays).toBeGreaterThan(0);
  });

  it("refuses to estimate maintenance without enough weigh-ins", () => {
    const result = observedMaintenance(mealsOf(28, 2000), { calorieTarget: 2000, weightEntries: weighIns(6, 80, -0.05) }, today);
    expect(result.status).toBe("insufficient");
  });

  it("puts maintenance above intake when the user is losing weight", () => {
    const result = observedMaintenance(mealsOf(28, 2000), { calorieTarget: 2000, weightEntries: weighIns(28, 80, -0.05) }, today);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("expected a reading");
    expect(result.meanIntake).toBe(2000);
    expect(result.weeklyChangeKg).toBeCloseTo(-0.35, 2);
    expect(result.observedMaintenance).toBe(2385);
  });

  it("puts maintenance below intake when the user is gaining weight", () => {
    const result = observedMaintenance(mealsOf(28, 2000), { calorieTarget: 2000, weightEntries: weighIns(28, 80, 0.05) }, today);
    if (result.status !== "ready") throw new Error("expected a reading");
    expect(result.observedMaintenance).toBeLessThan(result.meanIntake);
  });

  it("ignores days carrying only a token entry", () => {
    const full = mealsOf(28, 2000);
    const sparse = full.map((meal, index) => (index % 4 === 0 ? meal : dayMeal(meal.loggedDate!, 200)));
    const result = observedMaintenance(sparse, { calorieTarget: 2000, weightEntries: weighIns(28, 80, -0.05) }, today);
    expect(result.status).toBe("insufficient");
    if (result.status !== "insufficient") throw new Error("expected insufficient");
    expect(result.countedDays).toBe(7);
  });

  it("blends toward the formula rather than jumping to the observation", () => {
    expect(blendedMaintenance(2365, 2587)).toBe(2476);
  });

  it("only suggests a change the user would notice", () => {
    expect(maintenanceDiffersEnough(2365, 2587)).toBe(true);
    expect(maintenanceDiffersEnough(2560, 2587)).toBe(false);
  });
});

describe("custom target adherence", () => {
  const heldSince = new Date("2026-07-01T12:00:00").toISOString();
  const customProfile = { calorieTarget: 1800, calorieTargetMode: "custom" as const, calorieTargetSetAt: heldSince };

  it("says nothing about a calculated target", () => {
    expect(customTargetAdherence(mealsOf(21, 2200), { ...customProfile, calorieTargetMode: "calculated" }, today).status).toBe("insufficient");
  });

  it("waits before judging a target the user only just set", () => {
    const justSet = { ...customProfile, calorieTargetSetAt: new Date("2026-08-05T12:00:00").toISOString() };
    expect(customTargetAdherence(mealsOf(21, 2200), justSet, today).status).toBe("insufficient");
  });

  it("flags a target the user consistently eats past", () => {
    const result = customTargetAdherence(mealsOf(21, 2200), customProfile, today);
    expect(result.status).toBe("overshooting");
    if (result.status === "insufficient") throw new Error("expected a reading");
    expect(result.overDays).toBe(result.countedDays);
    expect(result.meanIntake).toBe(2200);
  });

  it("never flags a user who eats under their own target", () => {
    expect(customTargetAdherence(mealsOf(21, 1500), customProfile, today).status).toBe("holding");
  });

  it("treats intake inside the tolerance band as holding", () => {
    expect(customTargetAdherence(mealsOf(21, 1900), customProfile, today).status).toBe("holding");
  });

  it("does not flag a minority of days over target", () => {
    const meals = dateKeyWindow(21, today).map((date, index) => dayMeal(date, index % 2 === 0 ? 2200 : 1700));
    const result = customTargetAdherence(meals, customProfile, today);
    expect(result.status).toBe("holding");
  });
});
