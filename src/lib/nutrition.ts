import { effectiveCalorieTarget } from "./energy";
import { calorieTargetModes, currentTargetModelVersion, defaultNutritionTargets, type DailyTargets, type DietPreset, type Food, type GoalMode, type MacroPresetOverride, type MealTimeBoundaries, type MealType, type Micronutrients, type Nutrition, type Profile, type ServingUnit, type WeekStartDay, type Weekday } from "./types";

export const EMPTY_NUTRITION: Nutrition = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sugar: 0,
};

export const EMPTY_MICRONUTRIENTS: Micronutrients = {
  sodiumMg: 0, cholesterolMg: 0, saturatedFatG: 0, potassiumMg: 0, calciumMg: 0,
  ironMg: 0, magnesiumMg: 0, zincMg: 0, vitaminAMcg: 0, vitaminCMg: 0,
  vitaminDMcg: 0, vitaminEMg: 0, vitaminKMcg: 0, vitaminB12Mcg: 0, folateMcg: 0,
};

export function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function netCarbs(nutrition: Pick<Nutrition, "carbs" | "fiber">) {
  return Math.max(0, round(nutrition.carbs - nutrition.fiber));
}

export function normalizeNutritionTargets(profile: Profile): Profile {
  return {
    ...profile,
    sugarTarget: profile.sugarTarget ?? defaultNutritionTargets.sugar,
    saturatedFatTarget: profile.saturatedFatTarget ?? defaultNutritionTargets.saturatedFat,
    sodiumTarget: profile.sodiumTarget ?? defaultNutritionTargets.sodiumMg,
    potassiumTarget: profile.potassiumTarget ?? defaultNutritionTargets.potassiumMg,
  };
}

const weekdays: Weekday[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function baseDailyTargets(profile: Pick<Profile, "calorieTarget" | "proteinTarget" | "carbsTarget" | "fatTarget" | "fiberTarget">): DailyTargets {
  return { calories: profile.calorieTarget, protein: profile.proteinTarget, carbs: profile.carbsTarget, fat: profile.fatTarget, fiber: profile.fiberTarget };
}

export function resolveDailyTargets(profile: Pick<Profile, "calorieTarget" | "proteinTarget" | "carbsTarget" | "fatTarget" | "fiberTarget" | "dailyTargets">, dateKey: string): DailyTargets {
  const date = new Date(`${dateKey}T12:00:00`);
  const fallback = baseDailyTargets(profile);
  if (Number.isNaN(date.getTime())) return fallback;
  return profile.dailyTargets?.[weekdays[date.getDay()]] || fallback;
}

export function resolveMealCalorieTarget(profile: Pick<Profile, "mealCalorieTargets">, mealType: MealType) {
  return profile.mealCalorieTargets?.[mealType];
}

export type LowMacroKey = "calories" | "protein" | "carbs" | "fat" | "fiber";

/** Same tolerance-band convention as Insights' on-track check, applied per macro instead of just calories. */
export function lowestTrackedMacros(total: Nutrition, targets: DailyTargets, options: { tolerancePercent?: number; includeCalories?: boolean; max?: number } = {}): Array<{ key: LowMacroKey; current: number; target: number }> {
  const tolerance = (options.tolerancePercent ?? 10) / 100;
  const candidates: LowMacroKey[] = [...(options.includeCalories ? (["calories"] as const) : []), "protein", "fiber", "carbs", "fat"];
  const loggedEnough = targets.calories > 0 ? total.calories >= targets.calories * 0.15 : (total.protein + total.carbs + total.fat) >= 15;
  if (!loggedEnough) return [];
  return candidates
    .map((key) => ({ key, current: total[key], target: targets[key] }))
    .filter(({ current, target }) => target > 0 && current < target * (1 - tolerance))
    .sort((a, b) => (a.current / a.target) - (b.current / b.target))
    .slice(0, options.max ?? 2);
}

export function sumNutrition(items: Nutrition[]): Nutrition {
  const total = items.reduce(
    (total, item) => ({
      calories: total.calories + item.calories,
      protein: total.protein + item.protein,
      carbs: total.carbs + item.carbs,
      fat: total.fat + item.fat,
      fiber: total.fiber + item.fiber,
      sugar: total.sugar + item.sugar,
    }),
    { ...EMPTY_NUTRITION },
  );
  const micronutrients = items.filter((item) => item.micronutrients).reduce((sum, item) => {
    const micros = item.micronutrients || EMPTY_MICRONUTRIENTS;
    return Object.fromEntries(Object.keys(EMPTY_MICRONUTRIENTS).map((key) => [key, sum[key as keyof Micronutrients] + micros[key as keyof Micronutrients]])) as Micronutrients;
  }, { ...EMPTY_MICRONUTRIENTS });
  const micronutrientsIncomplete = items.length > 0 && items.some((item) => !item.micronutrients);
  return items.some((item) => item.micronutrients) ? { ...total, micronutrients, micronutrientsIncomplete } : total;
}

export function scaleNutrition(per100: Nutrition, grams: number, macroDigits = 1): Nutrition {
  const ratio = Math.max(0, grams) / 100;
  const scaled: Nutrition = {
    calories: round(per100.calories * ratio, 0),
    protein: round(per100.protein * ratio, macroDigits),
    carbs: round(per100.carbs * ratio, macroDigits),
    fat: round(per100.fat * ratio, macroDigits),
    fiber: round(per100.fiber * ratio, macroDigits),
    sugar: round(per100.sugar * ratio, macroDigits),
  };
  if (per100.micronutrients) {
    scaled.micronutrients = Object.fromEntries(Object.keys(per100.micronutrients).map((key) => [key, round(per100.micronutrients![key as keyof Micronutrients] * ratio, 2)])) as Micronutrients;
  }
  return scaled;
}

/** Inverse of scaleNutrition: nutrition known for `grams` grams, expressed per 100 g. */
export function nutritionPer100Grams(nutrition: Nutrition, grams: number, macroDigits = 1): Nutrition {
  if (!(grams > 0)) return nutrition;
  return scaleNutrition(nutrition, 10_000 / grams, macroDigits);
}

export function gramsFor(food: Food, amount: number, unit: ServingUnit, overrides?: { tbspGrams?: number; tspGrams?: number }): number {
  const safeAmount = Math.max(0, amount || 0);
  const unitWeights: Record<ServingUnit, number> = {
    serving: food.servingGrams || 100,
    g: 1,
    "100g": 100,
    package: food.packageGrams || food.servingGrams || 100,
    piece: food.pieceGrams || food.servingGrams || 100,
    tbsp: overrides?.tbspGrams ?? 15,
    tsp: overrides?.tspGrams ?? 5,
    ml: 1,
  };
  return round(safeAmount * unitWeights[unit]);
}

export function contextualUnits(food: Food): ServingUnit[] {
  const name = `${food.name} ${food.brand || ""}`.toLowerCase();
  const units: ServingUnit[] = ["serving", "g", "100g"];
  if (food.packageGrams) units.splice(1, 0, "package");
  if (food.pieceGrams || /egg|meatball|fruit|apple|banana|slice|bar|cookie|piece|кюфте|яйце/.test(name)) {
    units.splice(1, 0, "piece");
  }
  if (/powder|sauce|oil|butter|spread|husk|seed|spice|syrup|прах|сос|масло/.test(name)) {
    units.push("tbsp", "tsp");
  }
  if (/drink|milk|juice|water|shake|yogurt|soup|напитка|мляко|сок/.test(name)) units.push("ml");
  return [...new Set(units)];
}

/**
 * Keeps `calorieTarget` consistent with the inputs it is derived from, so no editor has to remember
 * to recompute. Returns the identical reference when nothing changed — `useLocalFirstData` re-saves
 * the profile whenever a normalizer hands back a new object, and an unstable one would loop.
 *
 * A profile still on an older target model is left alone: the user is shown the one-time notice in
 * the target editor first, and the recompute lands when they acknowledge it.
 */
export function normalizeCalorieTarget(profile: Profile): Profile {
  if (profile.calorieTargetMode === calorieTargetModes.custom) return profile;
  if (profile.targetModelVersion !== currentTargetModelVersion) return profile;
  const calorieTarget = effectiveCalorieTarget(profile);
  return calorieTarget === profile.calorieTarget ? profile : { ...profile, calorieTarget };
}

/** Which macroPresetOverride fields each non-custom preset's calculation actually uses, for settings UI. */
export const macroPresetRuleFields: Record<Exclude<DietPreset, "custom">, Array<keyof MacroPresetOverride>> = {
  balanced: ["proteinPerKg", "fatPerKg"],
  "high-protein": ["proteinPerKg", "fatPerKg"],
  keto: ["proteinPerKg", "carbCap"],
  "high-protein-keto": ["proteinPerKg", "carbCap"],
  "low-fat": ["proteinPerKg", "fatPercent"],
};

export type MacroContext = {
  calories: number;
  weightKg: number;
  heightCm: number;
  goalMode: GoalMode;
  goalWeightKg?: number;
  preset: DietPreset;
  overrides?: Partial<Record<DietPreset, MacroPresetOverride>>;
};

export type MacroTargets = {
  protein: number;
  carbs: number;
  fat: number;
  /** Calories the preset could not fit into the target even after trimming fat and protein. */
  shortfallKcal: number;
};

/** Extra protein while cutting protects lean mass. The cap stops it compounding a preset override. */
const goalProteinBonus: Record<GoalMode, number> = { lose: 0.4, maintain: 0, gain: 0.1 };
const MAX_BONUS_PROTEIN_PER_KG = 2.4;
const MIN_PROTEIN_PER_KG = 1.2;
const FAT_FLOOR_PER_KG = 0.6;

const round5 = (value: number) => Math.round(value / 5) * 5;

/**
 * Protein scales with lean mass, not total mass. Without a body-fat input, a goal weight is the best
 * proxy available; failing that, cap at what this height would weigh at BMI 25, so a user carrying a
 * lot of fat is not told to eat 260 g of protein a day.
 */
function proteinBasisKg(context: MacroContext) {
  const goalWeightKg = context.goalWeightKg;
  if (typeof goalWeightKg === "number" && Number.isFinite(goalWeightKg) && goalWeightKg > 0) {
    return Math.min(context.weightKg, goalWeightKg);
  }
  const heightM = context.heightCm / 100;
  return Math.min(context.weightKg, 25 * heightM * heightM);
}

/**
 * Fits protein, fat and carbs inside the calorie target. Carbs are the remainder; when protein and
 * fat alone already exceed the target, fat comes down to its floor first, then protein, and whatever
 * still does not fit is reported rather than hidden behind a silent `carbs: 0`.
 */
function fitMacros(calories: number, protein: number, fat: number, proteinFloor: number, fatFloor: number, carbCap?: number): MacroTargets {
  let nextProtein = protein;
  let nextFat = fat;
  const fixedCarbKcal = (carbCap ?? 0) * 4;
  const overshoot = () => nextProtein * 4 + nextFat * 9 + fixedCarbKcal - calories;

  if (overshoot() > 0) {
    const cut = Math.min(Math.max(0, nextFat - fatFloor), Math.ceil(overshoot() / 9 / 5) * 5);
    if (cut > 0) nextFat -= cut;
  }
  if (overshoot() > 0) {
    const cut = Math.min(Math.max(0, nextProtein - proteinFloor), Math.ceil(overshoot() / 4 / 5) * 5);
    if (cut > 0) nextProtein -= cut;
  }

  const remainderKcal = calories - nextProtein * 4 - nextFat * 9 - fixedCarbKcal;
  return {
    protein: nextProtein,
    fat: nextFat,
    carbs: carbCap ?? Math.max(0, round5(remainderKcal / 4)),
    shortfallKcal: Math.max(0, Math.round(-remainderKcal)),
  };
}

export function calculateMacroTargets(context: MacroContext): MacroTargets {
  const rules: Record<Exclude<DietPreset, "custom">, { proteinPerKg: number; fatPerKg?: number; carbCap?: number; fatPercent?: number }> = {
    balanced: { proteinPerKg: 1.8, fatPerKg: 0.9 },
    "high-protein": { proteinPerKg: 2.2, fatPerKg: 0.8 },
    keto: { proteinPerKg: 1.8, carbCap: 25 },
    "high-protein-keto": { proteinPerKg: 2.2, carbCap: 30 },
    "low-fat": { proteinPerKg: 1.8, fatPercent: 0.2 },
  };
  const rule = { ...rules[context.preset === "custom" ? "balanced" : context.preset], ...context.overrides?.[context.preset] };
  const basis = proteinBasisKg(context);
  const proteinPerKg = Math.max(rule.proteinPerKg, Math.min(rule.proteinPerKg + goalProteinBonus[context.goalMode], MAX_BONUS_PROTEIN_PER_KG));
  const protein = round5(basis * proteinPerKg);
  const proteinFloor = round5(basis * MIN_PROTEIN_PER_KG);
  const fatFloor = Math.max(30, round5(basis * FAT_FLOOR_PER_KG));

  if (rule.carbCap) {
    const fat = Math.max(fatFloor, round5((context.calories - protein * 4 - rule.carbCap * 4) / 9));
    return fitMacros(context.calories, protein, fat, proteinFloor, fatFloor, rule.carbCap);
  }
  const fat = Math.max(fatFloor, rule.fatPercent
    ? round5((context.calories * rule.fatPercent) / 9)
    : round5(basis * (rule.fatPerKg || 0.8)));
  return fitMacros(context.calories, protein, fat, proteinFloor, fatFloor);
}

/** Monday of the week containing `dateKey` (or Sunday, when `weekStartsOn` is "sunday"). */
export function startOfWeek(dateKey: string, weekStartsOn: WeekStartDay = "monday"): Date {
  const day = new Date(`${dateKey}T12:00:00`);
  const weekday = day.getDay();
  const offset = weekStartsOn === "sunday" ? -weekday : (weekday === 0 ? -6 : 1) - weekday;
  day.setDate(day.getDate() + offset);
  return day;
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const defaultMealTimeBoundaries: MealTimeBoundaries = { breakfastEndsHour: 11, lunchEndsHour: 15, dinnerEndsHour: 20 };

/** Suggest a meal using the browser's local timezone; callers can still let the user override it. */
export function suggestedMealType(date = new Date(), boundaries: MealTimeBoundaries = defaultMealTimeBoundaries): MealType {
  const hour = date.getHours();
  if (hour < boundaries.breakfastEndsHour) return "breakfast";
  if (hour < boundaries.lunchEndsHour) return "lunch";
  if (hour < boundaries.dinnerEndsHour) return "dinner";
  return "snack";
}

export function formatUnit(unit: ServingUnit, amount: number) {
  const labels: Record<ServingUnit, string> = {
    serving: amount === 1 ? "serving" : "servings",
    g: "g",
    "100g": "× 100 g",
    package: amount === 1 ? "package" : "packages",
    piece: amount === 1 ? "piece" : "pieces",
    tbsp: "tbsp",
    tsp: "tsp",
    ml: "ml",
  };
  return labels[unit];
}
