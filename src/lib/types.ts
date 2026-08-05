export type Nutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  /** Optional for backwards compatibility with meals logged before micronutrients were added. */
  micronutrients?: Micronutrients;
  /** True when at least one summed item had no micronutrient data, so the micronutrient totals undercount. */
  micronutrientsIncomplete?: boolean;
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

export type FoodSource = "seed" | "open-food-facts" | "food-data-central" | "restaurant" | "ai-label" | "custom";

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
  /** Identifies the saved recipe this component was logged from. */
  recipeId?: string;
  /** Groups all component foods added in one recipe logging action. */
  recipeLogId?: string;
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
  /** Optional user-supplied meal photo, stored locally as a resized image data URL. */
  imageUrl?: string;
  /** Explicitly groups a late entry with an earlier eating session. */
  fastingSessionId?: string;
  source: FoodSource;
  estimated?: boolean;
};

export const diaryShareScopes = { diary: "diary" } as const;
export type DiaryShareScope = typeof diaryShareScopes[keyof typeof diaryShareScopes];
export const diaryShareStatuses = { pending: "pending", accepted: "accepted", revoked: "revoked" } as const;
export type DiaryShareStatus = typeof diaryShareStatuses[keyof typeof diaryShareStatuses];

/** A private, read-only invitation to view a diary. Recipients cannot edit the owner's data. */
export type DiaryShare = {
  id: string;
  ownerId: string;
  recipientEmail: string;
  recipientId?: string;
  scope: DiaryShareScope;
  status: DiaryShareStatus;
  createdAt: string;
  acceptedAt?: string;
  revokedAt?: string;
};

export type Sex = "male" | "female";
export type GoalMode = "lose" | "maintain" | "gain";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very-active";
export type DietPreset = "balanced" | "high-protein" | "keto" | "high-protein-keto" | "low-fat" | "custom";
export const weightTrackingStatuses = { enabled: "enabled", disabled: "disabled" } as const;
export type WeightTrackingStatus = typeof weightTrackingStatuses[keyof typeof weightTrackingStatuses];
export const measurementSystems = { metric: "metric", imperial: "imperial" } as const;
export type MeasurementSystem = typeof measurementSystems[keyof typeof measurementSystems];
export const habitFeatures = { water: "water", fasting: "fasting" } as const;
export type HabitFeature = typeof habitFeatures[keyof typeof habitFeatures];
export const allHabitFeatures = [habitFeatures.water, habitFeatures.fasting] as const;
export const defaultHabitFeatures = [] as const;
export const fastingGoalHours = [12, 14, 16, 18, 24, 36, 48] as const;
export type FastingGoalHours = typeof fastingGoalHours[number];
export const fastingTrackingModes = { standard: "standard", precise: "precise" } as const;
export type FastingTrackingMode = typeof fastingTrackingModes[keyof typeof fastingTrackingModes];
export const fastingLateMealBehaviors = { ask: "ask", new: "new", previous: "previous" } as const;
export type FastingLateMealBehavior = typeof fastingLateMealBehaviors[keyof typeof fastingLateMealBehaviors];
export const recipeCookViews = { scroll: "scroll", step: "step" } as const;
export type RecipeCookView = typeof recipeCookViews[keyof typeof recipeCookViews];
export const glassSizesMl = [150, 200, 250, 300, 350, 500] as const;
export type GlassSizeMl = typeof glassSizesMl[number];
export const defaultNutritionTargets = { sugar: 50, saturatedFat: 20, sodiumMg: 2300, potassiumMg: 3500 } as const;
export type NutritionTargetKey = "sugarTarget" | "saturatedFatTarget" | "sodiumTarget" | "potassiumTarget";

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
  sugarTarget: number;
  saturatedFatTarget: number;
  sodiumTarget: number;
  potassiumTarget: number;
  hideCalories: boolean;
  showEstimatedBadges?: boolean;
  onboardingDone: boolean;
  measurementSystem?: MeasurementSystem;
  weightEntries?: WeightEntry[];
  weightTracking?: WeightTrackingStatus;
  dailyTargets?: Partial<Record<Weekday, DailyTargets>>;
  mealCalorieTargets?: Partial<Record<MealType, number>>;
  carbDisplay?: "total" | "net";
  waterTargetMl?: number;
  waterEntries?: WaterEntry[];
  glassSizeMl?: GlassSizeMl;
  enabledHabitFeatures?: HabitFeature[];
  planEnabled?: boolean;
  fastingGoalHours?: FastingGoalHours;
  fastingTrackingMode?: FastingTrackingMode;
  fastingMealWindowMinutes?: 15 | 30 | 60;
  fastingLateMealBehavior?: FastingLateMealBehavior;
  fastingRecordEdits?: Record<string, { startedAt: string; endedAt?: string }>;
  fastingRecords?: FastingRecord[];
  recipes?: Recipe[];
  mealPlanEntries?: MealPlanEntry[];
  /** Manually added shopping list ingredients, not tied to a planned recipe. */
  extraShoppingItems?: string[];
  recipeCookView?: RecipeCookView;
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

export type RecipeIngredient = {
  id: string;
  name: string;
  /** When the recipe was created from the diary, keep the source food and portion for optional swaps. */
  foodId?: string;
  amount?: number;
  unit?: ServingUnit;
  grams?: number;
  nutrition?: Nutrition;
  /** Freeform cooking-measurement display text (e.g. "2 cups", "3 cloves"), separate from amount/unit/grams used for nutrition math. */
  quantity?: string;
};

export const dietaryTags = {
  vegetarian: "vegetarian",
  vegan: "vegan",
  glutenFree: "glutenFree",
  dairyFree: "dairyFree",
  pescatarian: "pescatarian",
  keto: "keto",
  paleo: "paleo",
} as const;
export type DietaryTag = typeof dietaryTags[keyof typeof dietaryTags];

export const cuisines = {
  american: "american",
  australian: "australian",
  middleEastern: "middleEastern",
  mexican: "mexican",
  korean: "korean",
  thai: "thai",
  vegetarianFusion: "vegetarianFusion",
  westAfrican: "westAfrican",
  french: "french",
  indian: "indian",
} as const;
export type Cuisine = typeof cuisines[keyof typeof cuisines];

export const recipeOrigins = { created: "created", saved: "saved" } as const;
export type RecipeOrigin = typeof recipeOrigins[keyof typeof recipeOrigins];

export type Recipe = {
  id: string;
  name: string;
  servings: number;
  ingredients: RecipeIngredient[];
  nutritionPerServing: Nutrition;
  /** Grams for one serving. Defaults to the summed ingredient grams, then a flat fallback, when absent. */
  servingGrams?: number;
  /** Ordered cooking steps. */
  instructions?: string[];
  cuisine?: string;
  dietaryTags?: DietaryTag[];
  /** Optional user photos, stored locally as resized image data URLs. */
  imageUrls?: string[];
  /** True once this recipe has a mirrored row in the public catalogue. */
  isPublic?: boolean;
  /** Links this recipe to its public_recipes row when shared. */
  publicRecipeId?: string;
  /** "created" via the recipe composer, or "saved" by interacting with a catalogue recipe. Absent on older recipes; treat as "created". */
  origin?: RecipeOrigin;
  createdAt: string;
  updatedAt: string;
};

export type MealPlanEntry = {
  id: string;
  date: string;
  mealType: MealType;
} & ({ recipeId: string; foodId?: never } | { foodId: string; recipeId?: never });

export const publicRecipeSources = { community: "community", ai: "ai" } as const;
export type PublicRecipeSource = typeof publicRecipeSources[keyof typeof publicRecipeSources];

/** A shared row in the recipe catalogue, sourced either from a user's own recipe or an AI-assisted search. */
export type PublicRecipe = {
  id: string;
  name: string;
  servings: number;
  servingGrams: number;
  ingredients: RecipeIngredient[];
  nutritionPerServing: Nutrition;
  imageUrl?: string;
  /** Present when the photo is hotlinked from a source site; always shown with a visible credit + link. */
  imageCredit?: { label: string; sourceUrl: string };
  source: PublicRecipeSource;
  authorId?: string;
  /** Ordered cooking steps. */
  instructions: string[];
  cuisine?: string;
  dietaryTags: DietaryTag[];
  createdAt: string;
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
