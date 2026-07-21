import type { ActivityLevel, DailyTargets, DietPreset, Food, MealType, Micronutrients, Nutrition, Profile, ServingUnit, Weekday } from "./types";

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

export const activityMultipliers: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  "very-active": 1.9,
};

export function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function netCarbs(nutrition: Pick<Nutrition, "carbs" | "fiber">) {
  return Math.max(0, round(nutrition.carbs - nutrition.fiber));
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
  return items.some((item) => item.micronutrients) ? { ...total, micronutrients } : total;
}

export function scaleNutrition(per100: Nutrition, grams: number): Nutrition {
  const ratio = Math.max(0, grams) / 100;
  const scaled: Nutrition = {
    calories: round(per100.calories * ratio, 0),
    protein: round(per100.protein * ratio),
    carbs: round(per100.carbs * ratio),
    fat: round(per100.fat * ratio),
    fiber: round(per100.fiber * ratio),
    sugar: round(per100.sugar * ratio),
  };
  if (per100.micronutrients) {
    scaled.micronutrients = Object.fromEntries(Object.keys(per100.micronutrients).map((key) => [key, round(per100.micronutrients![key as keyof Micronutrients] * ratio, 2)])) as Micronutrients;
  }
  return scaled;
}

export function gramsFor(food: Food, amount: number, unit: ServingUnit): number {
  const safeAmount = Math.max(0, amount || 0);
  const unitWeights: Record<ServingUnit, number> = {
    serving: food.servingGrams || 100,
    g: 1,
    "100g": 100,
    package: food.packageGrams || food.servingGrams || 100,
    piece: food.pieceGrams || food.servingGrams || 100,
    tbsp: 15,
    tsp: 5,
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

export function calculateCalories(profile: Pick<Profile, "sex" | "age" | "heightCm" | "weightKg" | "activity" | "goalMode">) {
  const sexOffset = profile.sex === "male" ? 5 : -161;
  const bmr = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + sexOffset;
  const maintenance = bmr * activityMultipliers[profile.activity];
  const goalAdjustment = profile.goalMode === "lose" ? -450 : profile.goalMode === "gain" ? 250 : 0;
  return Math.max(1200, Math.round((maintenance + goalAdjustment) / 25) * 25);
}

export function calculateMacroTargets(calories: number, weightKg: number, preset: DietPreset) {
  const rules: Record<Exclude<DietPreset, "custom">, { proteinPerKg: number; fatPerKg?: number; carbCap?: number; fatPercent?: number }> = {
    balanced: { proteinPerKg: 1.8, fatPerKg: 0.9 },
    "high-protein": { proteinPerKg: 2.2, fatPerKg: 0.8 },
    keto: { proteinPerKg: 1.8, carbCap: 25 },
    "high-protein-keto": { proteinPerKg: 2.2, carbCap: 30 },
    "low-fat": { proteinPerKg: 1.8, fatPercent: 0.2 },
  };
  const rule = rules[preset === "custom" ? "balanced" : preset];
  const protein = Math.round(weightKg * rule.proteinPerKg / 5) * 5;
  if (rule.carbCap) {
    const carbs = rule.carbCap;
    const fat = Math.max(30, Math.round((calories - protein * 4 - carbs * 4) / 9 / 5) * 5);
    return { protein, carbs, fat };
  }
  const fat = rule.fatPercent
    ? Math.round((calories * rule.fatPercent) / 9 / 5) * 5
    : Math.round((weightKg * (rule.fatPerKg || 0.8)) / 5) * 5;
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4 / 5) * 5);
  return { protein, carbs, fat };
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Suggest a meal using the browser's local timezone; callers can still let the user override it. */
export function suggestedMealType(date = new Date()): MealType {
  const hour = date.getHours();
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 20) return "dinner";
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
