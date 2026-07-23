import type { FastingRecord, Meal, Profile } from "./types";

export function activeFast(records: FastingRecord[] | undefined) {
  return [...(records || [])].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).find((record) => !record.endedAt);
}

export function fastingProgress(startedAt: string, now: string, goalHours: number) {
  const elapsed = new Date(now).getTime() - new Date(startedAt).getTime();
  const target = Math.max(1, goalHours) * 60 * 60 * 1000;
  return Math.max(0, Math.min(1, elapsed / target));
}

export function fastingWindowHours(startedAt: string, endedAt: string) {
  return Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 36_000) / 100);
}

export function formatFastingDuration(hours: number) {
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${wholeHours}h ${minutes}min` : `${wholeHours}h`;
}

/** Keep the active fast anchored to the most recently logged meal. */
export function syncAutomaticFastAfterMeal(profile: Profile, meal: Meal) {
  if (!profile.enabledHabitFeatures?.includes("fasting") && profile.enabledHabitFeatures) return profile;

  const records = profile.fastingRecords || [];
  const active = activeFast(records);
  if (active?.startedAt === meal.createdAt) return profile;

  const mealTime = new Date(meal.createdAt).getTime();
  if (active && mealTime <= new Date(active.startedAt).getTime()) return profile;

  const nextRecords = records.map((record) => record.id === active?.id ? { ...record, endedAt: meal.createdAt } : record);
  nextRecords.push({ id: `auto-fast-${meal.id}`, startedAt: meal.createdAt });
  return { ...profile, fastingRecords: nextRecords };
}

/** Backfill automatic fasting for existing diaries when the feature is shown. */
export function syncAutomaticFasting(profile: Profile, meals: Meal[]) {
  const latestMeal = meals.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return latestMeal ? syncAutomaticFastAfterMeal(profile, latestMeal) : profile;
}
