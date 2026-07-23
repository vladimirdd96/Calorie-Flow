import type { FastingLateMealBehavior, FastingRecord, Meal, Profile } from "./types";

export const DEFAULT_FASTING_WINDOW_MINUTES = 30;

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

type EatingSession = { id: string; meals: Meal[]; startedAt: string; endedAt: string };

function windowMinutes(profile: Profile) {
  return profile.fastingMealWindowMinutes || DEFAULT_FASTING_WINDOW_MINUTES;
}

export function eatingSessions(profile: Profile, meals: Meal[]) {
  const sorted = meals.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const sessions: EatingSession[] = [];
  const explicitSessions = new Map<string, EatingSession>();
  const precise = profile.fastingTrackingMode === "precise";
  for (const meal of sorted) {
    const explicit = meal.fastingSessionId ? explicitSessions.get(meal.fastingSessionId) : undefined;
    const previous = sessions[sessions.length - 1];
    const sameMealType = previous?.meals.every((previousMeal) => previousMeal.mealType === meal.mealType);
    const closeEnough = previous && sameMealType && !precise && new Date(meal.createdAt).getTime() - new Date(previous.endedAt).getTime() <= windowMinutes(profile) * 60_000;
    const session = explicit || closeEnough ? explicit || previous : { id: meal.fastingSessionId || `auto-session-${meal.id}`, meals: [], startedAt: meal.createdAt, endedAt: meal.createdAt };
    session.meals.push(meal);
    if (meal.createdAt < session.startedAt) session.startedAt = meal.createdAt;
    if (meal.createdAt > session.endedAt) session.endedAt = meal.createdAt;
    if (!sessions.includes(session)) sessions.push(session);
    if (meal.fastingSessionId) explicitSessions.set(meal.fastingSessionId, session);
  }
  return sessions.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

export function fastingRecordsForMeals(profile: Profile, meals: Meal[]): FastingRecord[] {
  if ((profile.enabledHabitFeatures && !profile.enabledHabitFeatures.includes("fasting")) || !meals.length) return [];
  const sessions = eatingSessions(profile, meals);
  return sessions.map((session, index) => {
    const id = `auto-fast-${session.id}`;
    const generated = { id, startedAt: session.endedAt, ...(sessions[index + 1] ? { endedAt: sessions[index + 1].startedAt } : {}) };
    return profile.fastingRecordEdits?.[id] ? { ...generated, ...profile.fastingRecordEdits[id] } : generated;
  });
}

/** Rebuilds automatic records so history reflects eating sessions, not individual food entries. */
export function syncAutomaticFasting(profile: Profile, meals: Meal[]) {
  if (profile.enabledHabitFeatures && !profile.enabledHabitFeatures.includes("fasting")) return profile;
  const nextRecords = fastingRecordsForMeals(profile, meals);
  const manualRecords = (profile.fastingRecords || []).filter((record) => !record.id.startsWith("auto-fast-"));
  const merged = [...manualRecords, ...nextRecords];
  if (JSON.stringify(merged) === JSON.stringify(profile.fastingRecords || [])) return profile;
  return { ...profile, fastingRecords: merged };
}

/** Compatibility helper for callers that add one meal before the full diary is available. */
export function syncAutomaticFastAfterMeal(profile: Profile, meal: Meal) {
  if (profile.enabledHabitFeatures && !profile.enabledHabitFeatures.includes("fasting")) return profile;
  const records = profile.fastingRecords || [];
  const active = activeFast(records);
  if (active && new Date(meal.createdAt).getTime() > new Date(active.startedAt).getTime()) {
    return { ...profile, fastingRecords: [...records.map((record) => record.id === active.id ? { ...record, endedAt: meal.createdAt } : record), { id: `auto-fast-${meal.id}`, startedAt: meal.createdAt }] };
  }
  if (records.some((record) => record.startedAt === meal.createdAt)) return profile;
  return { ...profile, fastingRecords: [...records, { id: `auto-fast-${meal.id}`, startedAt: meal.createdAt }] };
}

export function lateMealBehavior(profile: Profile): FastingLateMealBehavior {
  return profile.fastingLateMealBehavior || "ask";
}

export function shouldAskAboutLateMeal(profile: Profile, meals: Meal[], meal: Meal) {
  if (profile.fastingTrackingMode === "precise" || lateMealBehavior(profile) !== "ask") return false;
  const previous = meals.filter((candidate) => candidate.createdAt < meal.createdAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return Boolean(previous && previous.mealType === meal.mealType && new Date(meal.createdAt).getTime() - new Date(previous.createdAt).getTime() > windowMinutes(profile) * 60_000);
}

export function sessionIdForMeal(profile: Profile, meals: Meal[], meal: Meal) {
  return eatingSessions(profile, meals).find((session) => session.meals.some((candidate) => candidate.id === meal.id))?.id;
}
