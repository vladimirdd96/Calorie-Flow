import { KCAL_PER_KG, maintenanceCalories, type TargetProfile } from "./energy";
import { dateKeyWindow, dayNumber, mealDayTotals, validWeightEntries } from "./mealDays";
import { calorieTargetModes, type Meal, type Profile } from "./types";

const MAINTENANCE_WINDOW_DAYS = 28;
const ADHERENCE_WINDOW_DAYS = 21;
const MIN_COUNTED_DAYS = 14;
const MIN_WEIGHT_ENTRIES = 6;
const MIN_WEIGHT_SPAN_DAYS = 14;
/** Share of counted days that must overshoot before we offer to rebuild a custom target. */
const OVERSHOOT_SHARE = 0.6;
/**
 * A day counts toward an energy estimate only if it carries most of a day's food. `lowestTrackedMacros`
 * uses 15% of target to mean "logged at all", which is far too loose here: one logged apple would drag
 * an observed maintenance figure down by hundreds of calories.
 */
const COMPLETE_DAY_FRACTION = 0.5;

type IntakeProfile = Pick<Profile, "calorieTarget" | "weightEntries">;

function countedDaysFor(meals: Meal[], calorieTarget: number, windowDays: number, today: Date) {
  const window = new Set(dateKeyWindow(windowDays, today));
  const bar = calorieTarget * COMPLETE_DAY_FRACTION;
  return mealDayTotals(meals)
    .filter((day) => window.has(day.date))
    .filter((day) => day.nutrition.calories >= bar);
}

const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;

/**
 * Least-squares slope in kilograms per day. First-minus-last is not good enough over these spans:
 * day-to-day water movement routinely exceeds the real trend.
 */
function weightSlopePerDay(points: Array<{ date: string; weightKg: number }>) {
  const xs = points.map((point) => dayNumber(point.date));
  const ys = points.map((point) => point.weightKg);
  const meanX = mean(xs);
  const meanY = mean(ys);
  const numerator = xs.reduce((total, x, index) => total + (x - meanX) * (ys[index] - meanY), 0);
  const denominator = xs.reduce((total, x) => total + (x - meanX) ** 2, 0);
  return denominator === 0 ? 0 : numerator / denominator;
}

export type ObservedMaintenance =
  | { status: "insufficient"; countedDays: number; weightEntries: number; needsDays: number; needsWeighIns: number }
  | { status: "ready"; observedMaintenance: number; meanIntake: number; weeklyChangeKg: number; countedDays: number; weightEntries: number };

/**
 * What the user's real intake and weight trend imply their maintenance is.
 *
 * Energy balance says `intake − maintenance` drives weight change, so a user losing weight is
 * eating below a maintenance that sits *above* their intake — hence the subtraction of a negative
 * slope.
 */
export function observedMaintenance(meals: Meal[], profile: IntakeProfile, today = new Date()): ObservedMaintenance {
  const counted = countedDaysFor(meals, profile.calorieTarget, MAINTENANCE_WINDOW_DAYS, today);
  const window = new Set(dateKeyWindow(MAINTENANCE_WINDOW_DAYS, today));
  const weights = validWeightEntries(profile.weightEntries)
    .filter((entry) => window.has(entry.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  const span = weights.length > 1 ? dayNumber(weights[weights.length - 1].date) - dayNumber(weights[0].date) : 0;

  if (counted.length < MIN_COUNTED_DAYS || weights.length < MIN_WEIGHT_ENTRIES || span < MIN_WEIGHT_SPAN_DAYS) {
    return {
      status: "insufficient",
      countedDays: counted.length,
      weightEntries: weights.length,
      needsDays: Math.max(0, MIN_COUNTED_DAYS - counted.length),
      needsWeighIns: Math.max(0, MIN_WEIGHT_ENTRIES - weights.length),
    };
  }

  const meanIntake = mean(counted.map((day) => day.nutrition.calories));
  const slopePerDay = weightSlopePerDay(weights);
  return {
    status: "ready",
    observedMaintenance: Math.round(meanIntake - slopePerDay * KCAL_PER_KG),
    meanIntake: Math.round(meanIntake),
    weeklyChangeKg: slopePerDay * 7,
    countedDays: counted.length,
    weightEntries: weights.length,
  };
}

/** Blend toward the formula so one noisy month cannot yank the target around. */
export function blendedMaintenance(observed: number, formula: number) {
  return Math.round((observed + formula) / 2);
}

/** Only worth interrupting the user for a difference they would actually notice. */
export function maintenanceDiffersEnough(observed: number, current: number) {
  return current > 0 && Math.abs(observed - current) / current > 0.05;
}

export type CustomTargetAdherence =
  | { status: "insufficient"; countedDays: number }
  | { status: "holding" | "overshooting"; countedDays: number; overDays: number; meanIntake: number };

/**
 * Whether a user-set target is one the user is actually able to hold.
 *
 * Only overshooting counts. Eating *under* a self-set target is not a failure state and must never
 * trigger a nudge — the point is to catch a number set below what someone's routine will sustain,
 * not to police them.
 */
export function customTargetAdherence(
  meals: Meal[],
  profile: Pick<Profile, "calorieTarget" | "calorieTargetMode" | "calorieTargetSetAt" | "insightsTolerancePercent">,
  today = new Date(),
): CustomTargetAdherence {
  if (profile.calorieTargetMode !== calorieTargetModes.custom) return { status: "insufficient", countedDays: 0 };
  const setAt = profile.calorieTargetSetAt ? new Date(profile.calorieTargetSetAt) : undefined;
  const heldDays = setAt && !Number.isNaN(setAt.getTime())
    ? (today.getTime() - setAt.getTime()) / 86_400_000
    : 0;
  if (heldDays < ADHERENCE_WINDOW_DAYS) return { status: "insufficient", countedDays: 0 };

  const counted = countedDaysFor(meals, profile.calorieTarget, ADHERENCE_WINDOW_DAYS, today);
  if (counted.length < MIN_COUNTED_DAYS) return { status: "insufficient", countedDays: counted.length };

  const tolerance = (profile.insightsTolerancePercent ?? 10) / 100;
  const ceiling = profile.calorieTarget * (1 + tolerance);
  const overDays = counted.filter((day) => day.nutrition.calories > ceiling).length;
  const meanIntake = Math.round(mean(counted.map((day) => day.nutrition.calories)));
  return {
    status: overDays / counted.length >= OVERSHOOT_SHARE ? "overshooting" : "holding",
    countedDays: counted.length,
    overDays,
    meanIntake,
  };
}

/** The maintenance figure to store when a user accepts either suggestion. */
export function acceptedMaintenance(observed: number, profile: TargetProfile) {
  return blendedMaintenance(observed, maintenanceCalories({ ...profile, maintenanceSource: undefined }).maintenance);
}
