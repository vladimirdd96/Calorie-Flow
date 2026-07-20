export type Nutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
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
  /** The local calendar day the user assigned when logging the meal. */
  loggedDate?: string;
  source: FoodSource;
  estimated?: boolean;
};

export type Sex = "male" | "female";
export type GoalMode = "lose" | "maintain" | "gain";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very-active";
export type DietPreset = "balanced" | "high-protein" | "keto" | "high-protein-keto" | "low-fat";

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
