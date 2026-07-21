export type Nutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  /** Optional for backwards compatibility with meals logged before micronutrients were added. */
  micronutrients?: Micronutrients;
};

/** Vitamins and minerals normalized to the units shown in the detail view. */
export type Micronutrients = {
  sodiumMg: number;
  cholesterolMg: number;
  saturatedFatG: number;
  potassiumMg: number;
  calciumMg: number;
  ironMg: number;
  magnesiumMg: number;
  zincMg: number;
  vitaminAMcg: number;
  vitaminCMg: number;
  vitaminDMcg: number;
  vitaminEMg: number;
  vitaminKMcg: number;
  vitaminB12Mcg: number;
  folateMcg: number;
};

export type FoodSource = "seed" | "open-food-facts" | "food-data-central" | "ai-label" | "custom";

export type Food = {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  imageUrl?: string;
  quantityLabel?: string;
  servingGrams?: number;
  servingLabel?: string;
  packageGrams?: number;
  pieceGrams?: number;
  nutrientsPer100: Nutrition;
  source: FoodSource;
  verified?: boolean;
  lastUsedAt?: string;
};

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type ServingUnit = "serving" | "g" | "100g" | "package" | "piece" | "tbsp" | "tsp" | "ml";

export type Meal = {
  id: string;
  foodId?: string;
  name: string;
  brand?: string;
  mealType: MealType;
  amount: number;
  unit: ServingUnit;
  grams: number;
  nutrition: Nutrition;
  createdAt: string;
  /** Position within the meal section for the logged day. Older entries omit this. */
  position?: number;
  /** The local calendar day the user assigned when logging the meal. */
  loggedDate?: string;
  source: FoodSource;
  estimated?: boolean;
};

export type Sex = "male" | "female";
export type GoalMode = "lose" | "maintain" | "gain";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very-active";
export type DietPreset = "balanced" | "high-protein" | "keto" | "high-protein-keto" | "low-fat" | "custom";
export const weightTrackingStatuses = { enabled: "enabled", disabled: "disabled" } as const;
export type WeightTrackingStatus = typeof weightTrackingStatuses[keyof typeof weightTrackingStatuses];
export const measurementSystems = { metric: "metric", imperial: "imperial" } as const;
export type MeasurementSystem = typeof measurementSystems[keyof typeof measurementSystems];

export type DailyTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

export type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export type Profile = {
  name: string;
  avatarUrl?: string;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goalMode: GoalMode;
  dietPreset: DietPreset;
  calorieTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  fiberTarget: number;
  hideCalories: boolean;
  onboardingDone: boolean;
  measurementSystem?: MeasurementSystem;
  weightEntries?: WeightEntry[];
  weightTracking?: WeightTrackingStatus;
  dailyTargets?: Partial<Record<Weekday, DailyTargets>>;
  carbDisplay?: "total" | "net";
  waterTargetMl?: number;
  waterEntries?: WaterEntry[];
  fastingGoalHours?: 12 | 14 | 16;
  fastingRecords?: FastingRecord[];
};

export type WeightEntry = {
  date: string;
  weightKg: number;
};

export type WaterEntry = {
  date: string;
  amountMl: number;
};

export type FastingRecord = {
  id: string;
  startedAt: string;
  endedAt?: string;
};

export type LabelAnalysis = {
  productName: string | null;
  brand: string | null;
  barcode: string | null;
  per100: Nutrition;
  servingSizeG: number | null;
  packageSizeG: number | null;
  confidence: "low" | "medium" | "high";
  needsFollowUp: boolean;
  followUpQuestions: string[];
};

export type MealPhotoAnalysis = {
  name: string;
  mealType: MealType;
  amount: number;
  unit: ServingUnit;
  grams: number;
  nutrition: Nutrition;
  components: string[];
  confidence: "low" | "medium" | "high";
};

export type CoachMealAction = {
  name: string;
  mealType: MealType;
  amount: number;
  unit: ServingUnit;
  grams: number;
  nutrition: Nutrition;
  loggedDate: string;
  estimated: boolean;
};

export type CoachMealChoice = {
  label: string;
  meal: CoachMealAction;
};

export type CoachMessage = {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type CoachChat = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};
