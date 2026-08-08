import { calorieTargetModes, goalPaces, maintenanceSources, type ActivityLevel, type GoalMode, type GoalPace, type MaintenanceSource, type Profile, type Sex } from "./types";

/** Energy released or stored per kilogram of bodyweight change — the conventional 7,700 kcal/kg. */
export const KCAL_PER_KG = 7_700;

export const activityMultipliers: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  "very-active": 1.9,
};

/**
 * Pace as a percentage of bodyweight per week, so "aggressive" means the same thing to a 55 kg and
 * a 110 kg user. Flat calorie deltas did not: −650 kcal is a 19% cut for one and a 38% cut for the
 * other. These rates land within a few tens of calories of the old deltas at an average bodyweight.
 */
export const goalPaceRates: Record<Exclude<GoalMode, "maintain">, Record<GoalPace, number>> = {
  lose: { conservative: 0.25, moderate: 0.5, aggressive: 0.75 },
  gain: { conservative: 0.125, moderate: 0.25, aggressive: 0.375 },
};

/** Absolute lower bounds, applied alongside the user's own BMR — whichever is higher wins. */
const absoluteCalorieFloors: Record<Sex, number> = { male: 1_500, female: 1_200 };

type BodyProfile = Pick<Profile, "sex" | "age" | "heightCm" | "weightKg">;
type PaceProfile = Pick<Profile, "weightKg" | "goalMode" | "goalPace">;
type MaintenanceProfile = BodyProfile & Pick<Profile, "activity" | "maintenanceSource" | "observedMaintenanceKcal">;
export type TargetProfile = MaintenanceProfile & PaceProfile;

export type CalorieTargetClamp =
  | { kind: "none" }
  | { kind: "floor"; floor: number; requested: number };

export type CalorieTargetResult = {
  bmr: number;
  maintenance: number;
  maintenanceSource: MaintenanceSource;
  /** Signed: negative on a cut, positive on a gain. */
  dailyDelta: number;
  /** Signed kilograms per week implied by the pace. */
  weeklyRateKg: number;
  target: number;
  clamp: CalorieTargetClamp;
};

const roundToStep = (value: number, step: number) => Math.round(value / step) * step;
const ceilToStep = (value: number, step: number) => Math.ceil(value / step) * step;

export function basalMetabolicRate(profile: BodyProfile) {
  const sexOffset = profile.sex === "male" ? 5 : -161;
  return 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + sexOffset;
}

/** Never recommend eating below resting burn; the deficit should come out of activity, not organs. */
export function calorieFloorFor(profile: BodyProfile) {
  return Math.max(absoluteCalorieFloors[profile.sex], Math.round(basalMetabolicRate(profile)));
}

export function maintenanceCalories(profile: MaintenanceProfile): { maintenance: number; source: MaintenanceSource } {
  const observed = profile.observedMaintenanceKcal;
  if (profile.maintenanceSource === maintenanceSources.observed && typeof observed === "number" && Number.isFinite(observed) && observed > 0) {
    return { maintenance: observed, source: maintenanceSources.observed };
  }
  return { maintenance: basalMetabolicRate(profile) * activityMultipliers[profile.activity], source: maintenanceSources.formula };
}

/** Signed kilograms per week the chosen pace implies. Zero while maintaining. */
export function weeklyRateFor(profile: PaceProfile) {
  if (profile.goalMode === "maintain") return 0;
  const percent = goalPaceRates[profile.goalMode][profile.goalPace || goalPaces.moderate];
  const magnitude = (percent / 100) * profile.weightKg;
  return profile.goalMode === "lose" ? -magnitude : magnitude;
}

export function resolveCalorieTarget(profile: TargetProfile, roundingStep = 25): CalorieTargetResult {
  const bmr = basalMetabolicRate(profile);
  const { maintenance, source } = maintenanceCalories(profile);
  const weeklyRateKg = weeklyRateFor(profile);
  const dailyDelta = (weeklyRateKg * KCAL_PER_KG) / 7;
  const floor = calorieFloorFor(profile);
  const requested = roundToStep(maintenance + dailyDelta, roundingStep);
  const flooredTarget = ceilToStep(floor, roundingStep);
  const target = Math.max(requested, flooredTarget);
  return {
    bmr,
    maintenance,
    maintenanceSource: source,
    dailyDelta,
    weeklyRateKg,
    target,
    clamp: target > requested ? { kind: "floor", floor, requested } : { kind: "none" },
  };
}

/** Convenience wrapper for callers that only want the number. */
export function calculateCalories(profile: TargetProfile, roundingStep = 25) {
  return resolveCalorieTarget(profile, roundingStep).target;
}

export type CustomTargetInsight = {
  maintenance: number;
  /** Signed percentage away from maintenance — negative is a deficit. */
  deltaPercent: number;
  /** Signed kilograms per week the typed number implies. */
  weeklyRateKg: number;
  floor: number;
  belowFloor: boolean;
  /** True when the typed number moves faster than the aggressive preset for the current goal. */
  steeperThanAggressive: boolean;
  /** The fastest pace we would suggest, for the copy that offers an alternative. */
  suggestedFloorTarget: number;
};

/**
 * Runs a user-typed target backwards through the same model, so an override is annotated rather
 * than silent. A number above the floor is always allowed — this only describes what was chosen.
 */
export function describeCustomTarget(profile: TargetProfile, target: number, roundingStep = 25): CustomTargetInsight {
  const { maintenance } = maintenanceCalories(profile);
  const floor = calorieFloorFor(profile);
  const delta = target - maintenance;
  const weeklyRateKg = (delta * 7) / KCAL_PER_KG;
  const aggressiveRate = profile.goalMode === "maintain"
    ? 0
    : (goalPaceRates[profile.goalMode].aggressive / 100) * profile.weightKg;
  return {
    maintenance,
    deltaPercent: maintenance > 0 ? (delta / maintenance) * 100 : 0,
    weeklyRateKg,
    floor,
    belowFloor: target < floor,
    steeperThanAggressive: aggressiveRate > 0 && Math.abs(weeklyRateKg) > aggressiveRate,
    suggestedFloorTarget: resolveCalorieTarget({ ...profile, goalPace: goalPaces.aggressive }, roundingStep).target,
  };
}

export type GoalEta =
  | { status: "none" }
  | { status: "reached" }
  | { status: "wrong-direction"; goalMode: GoalMode }
  | { status: "ready"; weeks: number; date: Date };

/** Goal weight yields a projection; it never drives the pace. */
export function estimateGoalEta(profile: PaceProfile & Pick<Profile, "goalWeightKg">, from = new Date()): GoalEta {
  const goalWeightKg = profile.goalWeightKg;
  if (typeof goalWeightKg !== "number" || !Number.isFinite(goalWeightKg)) return { status: "none" };
  const difference = goalWeightKg - profile.weightKg;
  if (Math.abs(difference) < 0.1) return { status: "reached" };
  if (profile.goalMode === "maintain") return { status: "wrong-direction", goalMode: profile.goalMode };
  if (profile.goalMode === "lose" && difference > 0) return { status: "wrong-direction", goalMode: profile.goalMode };
  if (profile.goalMode === "gain" && difference < 0) return { status: "wrong-direction", goalMode: profile.goalMode };
  const rate = Math.abs(weeklyRateFor(profile));
  if (!(rate > 0)) return { status: "none" };
  const weeks = Math.abs(difference) / rate;
  const date = new Date(from);
  date.setDate(date.getDate() + Math.round(weeks * 7));
  return { status: "ready", weeks, date };
}

type EffectiveProfile = TargetProfile & Pick<Profile, "calorieTargetMode" | "calorieTarget" | "calorieRoundingStep">;

/** The single place that decides what a profile's daily calorie target actually is. */
export function effectiveCalorieTarget(profile: EffectiveProfile) {
  if (profile.calorieTargetMode === calorieTargetModes.custom) return profile.calorieTarget;
  return resolveCalorieTarget(profile, profile.calorieRoundingStep ?? 25).target;
}
