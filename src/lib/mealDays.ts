import { localDateKey, sumNutrition } from "./nutrition";
import type { Meal, Nutrition, Profile, WeightEntry } from "./types";

/** The calendar day an entry counts toward: the day the user assigned it to, else the day it was created. */
export function loggedDateKey(meal: Pick<Meal, "loggedDate" | "createdAt">) {
  return meal.loggedDate || localDateKey(new Date(meal.createdAt));
}

/** Per-day nutrition totals, ascending by date. Days with no entries are absent rather than zero. */
export function mealDayTotals(meals: Meal[]): Array<{ date: string; nutrition: Nutrition }> {
  const totals = meals.reduce((days, meal) => {
    const key = loggedDateKey(meal);
    const previous = days.get(key);
    days.set(key, previous ? sumNutrition([previous, meal.nutrition]) : meal.nutrition);
    return days;
  }, new Map<string, Nutrition>());
  return Array.from(totals, ([date, nutrition]) => ({ date, nutrition })).sort((a, b) => a.date.localeCompare(b.date));
}

/** Guards against a corrupted or legacy profile blob, which is never validated on the local read path. */
export function validWeightEntries(entries: Profile["weightEntries"]): WeightEntry[] {
  return (Array.isArray(entries) ? entries : []).filter((entry): entry is WeightEntry => typeof entry?.date === "string" && Number.isFinite(entry.weightKg));
}

/** Whole days since the epoch, read at local noon so a DST shift cannot move a date across a boundary. */
export function dayNumber(dateKey: string) {
  return Math.round(new Date(`${dateKey}T12:00:00`).getTime() / 86_400_000);
}

/** Inclusive list of the `count` most recent local date keys ending at `today`, ascending. */
export function dateKeyWindow(count: number, today = new Date()): string[] {
  return Array.from({ length: Math.max(1, count) }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (count - 1 - index));
    return localDateKey(date);
  });
}
