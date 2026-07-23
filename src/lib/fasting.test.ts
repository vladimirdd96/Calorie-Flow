import { describe, expect, it } from "vitest";
import { activeFast, eatingSessions, fastingProgress, fastingRecordsForMeals, fastingWindowHours, formatFastingDuration, shouldAskAboutLateMeal, syncAutomaticFastAfterMeal, syncAutomaticFasting } from "./fasting";
import type { Meal, Profile } from "./types";

const profile = { enabledHabitFeatures: ["fasting"], fastingRecords: [] } as unknown as Profile;
const meal = { id: "meal-1", createdAt: "2026-07-21T18:00:00.000Z" } as Meal;

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

  it("formats fasting durations as hours and minutes", () => {
    expect(formatFastingDuration(13.833333)).toBe("13h 50min");
    expect(formatFastingDuration(16)).toBe("16h");
  });

  it("starts an automatic fast at the latest logged meal", () => {
    const next = syncAutomaticFasting(profile, [meal]);
    expect(activeFast(next.fastingRecords)?.startedAt).toBe(meal.createdAt);
  });

  it("ends the previous automatic fast when a new meal is logged", () => {
    const started = syncAutomaticFastAfterMeal(profile, meal);
    const nextMeal = { ...meal, id: "meal-2", createdAt: "2026-07-22T06:00:00.000Z" };
    const next = syncAutomaticFastAfterMeal(started, nextMeal);
    expect(started.fastingRecords?.[0].endedAt).toBeUndefined();
    expect(started.fastingRecords?.[0].startedAt).toBe(meal.createdAt);
    expect(next.fastingRecords?.[0].endedAt).toBe(nextMeal.createdAt);
    expect(activeFast(next.fastingRecords)?.startedAt).toBe(nextMeal.createdAt);
  });

  it("does not create records when fasting is disabled", () => {
    const disabled = { ...profile, enabledHabitFeatures: [] };
    expect(syncAutomaticFasting(disabled, [meal])).toBe(disabled);
  });

  it("groups foods logged within the standard meal window", () => {
    const meals = [
      { ...meal, mealType: "breakfast" as const },
      { ...meal, id: "meal-2", mealType: "breakfast" as const, createdAt: "2026-07-21T18:01:00.000Z" },
      { ...meal, id: "meal-3", mealType: "dinner" as const, createdAt: "2026-07-22T06:00:00.000Z" },
    ];
    const next = syncAutomaticFasting(profile, meals);
    expect(eatingSessions(profile, meals)).toHaveLength(2);
    expect(next.fastingRecords).toHaveLength(2);
    expect(next.fastingRecords?.[0].endedAt).toBe("2026-07-22T06:00:00.000Z");
  });

  it("does not ask to join a different meal type", () => {
    const previous = { ...meal, mealType: "breakfast" as const };
    const next = { ...meal, id: "meal-2", mealType: "lunch" as const, createdAt: "2026-07-21T20:00:00.000Z" };
    expect(shouldAskAboutLateMeal(profile, [previous], next)).toBe(false);
  });

  it("keeps precise food timestamps as separate interruptions", () => {
    const precise = { ...profile, fastingTrackingMode: "precise" as const };
    const meals = [meal, { ...meal, id: "meal-2", createdAt: "2026-07-21T18:01:00.000Z" }];
    expect(eatingSessions(precise, meals)).toHaveLength(2);
  });

  it("preserves user-edited fasting times over automatic recalculation", () => {
    const edited = { ...profile, fastingRecordEdits: { "auto-fast-auto-session-meal-1": { startedAt: "2026-07-21T17:45:00.000Z", endedAt: "2026-07-22T06:15:00.000Z" } } };
    const records = fastingRecordsForMeals(edited, [meal, { ...meal, id: "meal-2", createdAt: "2026-07-22T06:00:00.000Z" }]);
    const sessions = eatingSessions(edited, [meal, { ...meal, id: "meal-2", createdAt: "2026-07-22T06:00:00.000Z" }]);
    expect(records[0].startedAt).toBe("2026-07-21T17:45:00.000Z");
    expect(records[0].endedAt).toBe("2026-07-22T06:15:00.000Z");
    expect(sessions[0].endedAt).toBe("2026-07-21T17:45:00.000Z");
    expect(sessions[1].startedAt).toBe("2026-07-22T06:15:00.000Z");
  });
});
