import { z } from "zod";
import { defaultNutritionTargets, recipeOrigins, type CoachChat, type CoachMealAction, type CoachMealChoice, type CoachMessage, type DailyTargets, type DiaryShare, type FastingRecord, type Food, type LabelAnalysis, type MacroPresetOverride, type Meal, type MealPhotoAnalysis, type MealPlanEntry, type Nutrition, type Profile, type PublicRecipe, type Recipe, type WaterEntry, type WeightEntry } from "./types";

const dietaryTagSchema = z.enum(["vegetarian", "vegan", "glutenFree", "dairyFree", "pescatarian", "keto", "paleo"]);
const recipeOriginSchema = z.enum([recipeOrigins.created, recipeOrigins.saved]);

const finiteNonNegative = z.number().finite().min(0);
const positiveFinite = z.number().finite().positive();
const optionalShortText = z.string().trim().max(240).optional();
const optionalAvatar = z.string().trim().max(400_000).refine((value) => {
  if (value.startsWith("data:image/")) return true;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}, "Avatar must be an image URL or an image data URL").optional();
const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const weightEntrySchema = z.object({ date: localDateSchema, weightKg: z.number().finite().min(20).max(500) }).strict() satisfies z.ZodType<WeightEntry>;
const waterEntrySchema = z.object({ date: localDateSchema, amountMl: z.number().finite().int().min(1).max(20_000) }).strict() satisfies z.ZodType<WaterEntry>;
const fastingRecordSchema = z.object({ id: z.string().trim().min(1).max(240), startedAt: z.string().datetime({ offset: true }), endedAt: z.string().datetime({ offset: true }).optional() }).strict() satisfies z.ZodType<FastingRecord>;
const mealPlanEntryBaseSchema = { id: z.string().trim().min(1).max(240), date: localDateSchema, mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]) };
export const mealPlanEntrySchema = z.union([
  z.object({ ...mealPlanEntryBaseSchema, recipeId: z.string().trim().min(1).max(240) }).strict(),
  z.object({ ...mealPlanEntryBaseSchema, foodId: z.string().trim().min(1).max(240) }).strict(),
]) satisfies z.ZodType<MealPlanEntry>;
const dailyTargetsSchema = z.object({ calories: positiveFinite.max(20_000), protein: finiteNonNegative.max(2_000), carbs: finiteNonNegative.max(2_000), fat: finiteNonNegative.max(2_000), fiber: finiteNonNegative.max(2_000) }).strict() satisfies z.ZodType<DailyTargets>;
const macroPresetOverrideSchema = z.object({
  proteinPerKg: z.number().finite().min(0).max(5).optional(),
  fatPerKg: z.number().finite().min(0).max(5).optional(),
  carbCap: z.number().finite().min(0).max(500).optional(),
  fatPercent: z.number().finite().min(0).max(1).optional(),
}).strict() satisfies z.ZodType<MacroPresetOverride>;

export const nutritionSchema = z.object({
  calories: finiteNonNegative,
  protein: finiteNonNegative,
  carbs: finiteNonNegative,
  fat: finiteNonNegative,
  fiber: finiteNonNegative,
  sugar: finiteNonNegative,
  micronutrientsIncomplete: z.boolean().optional(),
  micronutrients: z.object({
    sodiumMg: finiteNonNegative, cholesterolMg: finiteNonNegative, saturatedFatG: finiteNonNegative,
    potassiumMg: finiteNonNegative, calciumMg: finiteNonNegative, ironMg: finiteNonNegative,
    magnesiumMg: finiteNonNegative, zincMg: finiteNonNegative, vitaminAMcg: finiteNonNegative,
    vitaminCMg: finiteNonNegative, vitaminDMcg: finiteNonNegative, vitaminEMg: finiteNonNegative,
    vitaminKMcg: finiteNonNegative, vitaminB12Mcg: finiteNonNegative, folateMcg: finiteNonNegative,
  }).strict().optional(),
}).strict() satisfies z.ZodType<Nutrition>;

const recipeIngredientSchema = z.object({
  id: z.string().trim().min(1).max(240),
  name: z.string().trim().min(1).max(240),
  foodId: z.string().trim().max(240).optional(),
  amount: positiveFinite.max(100_000).optional(),
  unit: z.enum(["serving", "g", "100g", "package", "piece", "tbsp", "tsp", "ml"]).optional(),
  grams: positiveFinite.max(100_000).optional(),
  nutrition: nutritionSchema.optional(),
  quantity: z.string().trim().max(60).optional(),
}).strict();

const recipeSchema = z.object({ id: z.string().trim().min(1).max(240), name: z.string().trim().min(1).max(240), servings: positiveFinite.max(100), ingredients: z.array(recipeIngredientSchema).max(100), nutritionPerServing: nutritionSchema, servingGrams: positiveFinite.max(20_000).optional(), instructions: z.array(z.string().trim().min(1).max(500)).max(30).optional(), cuisine: z.string().trim().max(60).optional(), dietaryTags: z.array(dietaryTagSchema).max(20).optional(), imageUrls: z.array(z.string().min(1).max(400_000)).max(8).optional(), isPublic: z.boolean().optional(), publicRecipeId: z.string().trim().min(1).max(240).optional(), origin: recipeOriginSchema.optional(), createdAt: z.string().datetime({ offset: true }), updatedAt: z.string().datetime({ offset: true }) }).strict() satisfies z.ZodType<Recipe>;

export const foodSchema = z.object({
  id: z.string().trim().min(1).max(240),
  name: z.string().trim().min(1).max(240),
  brand: optionalShortText,
  barcode: z.string().trim().max(64).optional(),
  imageUrl: optionalAvatar,
  quantityLabel: optionalShortText,
  servingGrams: positiveFinite.optional(),
  servingLabel: optionalShortText,
  packageGrams: positiveFinite.optional(),
  pieceGrams: positiveFinite.optional(),
  nutrientsPer100: nutritionSchema,
  source: z.enum(["seed", "open-food-facts", "food-data-central", "restaurant", "ai-label", "custom"]),
  verified: z.boolean().optional(),
  lastUsedAt: z.string().datetime({ offset: true }).optional(),
}).strict() satisfies z.ZodType<Food>;

export const mealSchema = z.object({
  id: z.string().trim().min(1).max(240),
  foodId: z.string().trim().max(240).optional(),
  recipeId: z.string().trim().max(240).optional(),
  recipeLogId: z.string().trim().max(240).optional(),
  name: z.string().trim().min(1).max(240),
  brand: optionalShortText,
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  amount: positiveFinite,
  unit: z.enum(["serving", "g", "100g", "package", "piece", "tbsp", "tsp", "ml"]),
  grams: positiveFinite,
  nutrition: nutritionSchema,
  createdAt: z.string().datetime({ offset: true }),
  position: z.number().int().nonnegative().optional(),
  loggedDate: localDateSchema.optional(),
  imageUrl: optionalAvatar,
  fastingSessionId: z.string().trim().max(240).optional(),
  source: z.enum(["seed", "open-food-facts", "food-data-central", "restaurant", "ai-label", "custom"]),
  estimated: z.boolean().optional(),
}).strict() satisfies z.ZodType<Meal>;

export const diaryShareSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  recipientEmail: z.string().email().max(320),
  recipientId: z.string().uuid().optional(),
  scope: z.literal("diary"),
  status: z.enum(["pending", "accepted", "revoked"]),
  createdAt: z.string().datetime({ offset: true }),
  acceptedAt: z.string().datetime({ offset: true }).optional(),
  revokedAt: z.string().datetime({ offset: true }).optional(),
}).strict().superRefine((share, context) => {
  if ((share.status === "accepted") !== Boolean(share.recipientId)) context.addIssue({ code: "custom", message: "Accepted shares require a recipient." });
}) satisfies z.ZodType<DiaryShare>;

export const profileSchema = z.object({
  name: z.string().trim().max(120),
  avatarUrl: optionalAvatar,
  sex: z.enum(["male", "female"]),
  age: z.number().int().min(16).max(100),
  heightCm: z.number().finite().min(120).max(230),
  weightKg: z.number().finite().min(35).max(300),
  activity: z.enum(["sedentary", "light", "moderate", "active", "very-active"]),
  goalMode: z.enum(["lose", "maintain", "gain"]),
  dietPreset: z.enum(["balanced", "high-protein", "keto", "high-protein-keto", "low-fat", "custom"]),
  calorieTarget: positiveFinite.max(20_000),
  proteinTarget: finiteNonNegative.max(2_000),
  carbsTarget: finiteNonNegative.max(2_000),
  fatTarget: finiteNonNegative.max(2_000),
  fiberTarget: finiteNonNegative.max(2_000),
  sugarTarget: finiteNonNegative.max(2_000).default(defaultNutritionTargets.sugar),
  saturatedFatTarget: finiteNonNegative.max(2_000).default(defaultNutritionTargets.saturatedFat),
  sodiumTarget: finiteNonNegative.max(20_000).default(defaultNutritionTargets.sodiumMg),
  potassiumTarget: finiteNonNegative.max(20_000).default(defaultNutritionTargets.potassiumMg),
  hideCalories: z.boolean(),
  showEstimatedBadges: z.boolean().optional(),
  onboardingDone: z.boolean(),
  measurementSystem: z.enum(["metric", "imperial"]).optional(),
  weightEntries: z.array(weightEntrySchema).max(10_000).optional(),
  weightTracking: z.enum(["enabled", "disabled"]).optional(),
  dailyTargets: z.object({ monday: dailyTargetsSchema.optional(), tuesday: dailyTargetsSchema.optional(), wednesday: dailyTargetsSchema.optional(), thursday: dailyTargetsSchema.optional(), friday: dailyTargetsSchema.optional(), saturday: dailyTargetsSchema.optional(), sunday: dailyTargetsSchema.optional() }).strict().optional(),
  mealCalorieTargets: z.object({ breakfast: positiveFinite.max(20_000).optional(), lunch: positiveFinite.max(20_000).optional(), dinner: positiveFinite.max(20_000).optional(), snack: positiveFinite.max(20_000).optional() }).strict().optional(),
  carbDisplay: z.enum(["total", "net"]).optional(),
  waterTargetMl: z.number().finite().int().min(250).max(20_000).optional(),
  waterEntries: z.array(waterEntrySchema).max(10_000).optional(),
  glassSizeMl: z.union([z.literal(150), z.literal(200), z.literal(250), z.literal(300), z.literal(350), z.literal(500)]).optional(),
  enabledHabitFeatures: z.array(z.enum(["water", "fasting"])).max(2).refine((features) => new Set(features).size === features.length, "Habit features must not repeat").optional(),
  planEnabled: z.boolean().optional(),
  fastingGoalHours: z.union([z.literal(12), z.literal(14), z.literal(16), z.literal(18), z.literal(24), z.literal(36), z.literal(48)]).optional(),
  fastingTrackingMode: z.enum(["standard", "precise"]).optional(),
  fastingMealWindowMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]).optional(),
  fastingLateMealBehavior: z.enum(["ask", "new", "previous"]).optional(),
  fastingRecordEdits: z.record(z.string().trim().min(1).max(240), z.object({ startedAt: z.string().datetime({ offset: true }), endedAt: z.string().datetime({ offset: true }).optional() }).strict()).optional(),
  fastingRecords: z.array(fastingRecordSchema).max(10_000).optional(),
  recipes: z.array(recipeSchema).max(10_000).optional(),
  mealPlanEntries: z.array(mealPlanEntrySchema).max(100_000).optional(),
  extraShoppingItems: z.array(z.string().trim().max(240)).max(1_000).optional(),
  recipeCookView: z.enum(["scroll", "step"]).optional(),
  weekStartsOn: z.enum(["monday", "sunday"]).optional(),
  mealTimeBoundaries: z.object({
    breakfastEndsHour: z.number().int().min(0).max(23),
    lunchEndsHour: z.number().int().min(0).max(23),
    dinnerEndsHour: z.number().int().min(0).max(23),
  }).strict().optional(),
  goalPace: z.enum(["conservative", "moderate", "aggressive"]).optional(),
  macroPresetOverrides: z.object({
    balanced: macroPresetOverrideSchema.optional(),
    "high-protein": macroPresetOverrideSchema.optional(),
    keto: macroPresetOverrideSchema.optional(),
    "high-protein-keto": macroPresetOverrideSchema.optional(),
    "low-fat": macroPresetOverrideSchema.optional(),
    custom: macroPresetOverrideSchema.optional(),
  }).strict().optional(),
  calorieRoundingStep: z.union([z.literal(5), z.literal(10), z.literal(25), z.literal(50)]).optional(),
  macroRoundingDigits: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  tbspGrams: z.number().finite().min(1).max(60).optional(),
  tspGrams: z.number().finite().min(1).max(60).optional(),
  insightsTolerancePercent: z.number().finite().min(1).max(50).optional(),
  insightsDefaultRange: z.enum(["week", "month", "all"]).optional(),
}).strict() satisfies z.ZodType<Profile>;

export const coachMessageSchema = z.object({
  id: z.string().trim().min(1).max(240),
  chatId: z.string().trim().min(1).max(240).default("legacy"),
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(12_000),
  createdAt: z.string().datetime({ offset: true }),
}).strict() satisfies z.ZodType<CoachMessage>;

export const coachChatSchema = z.object({
  id: z.string().trim().min(1).max(240),
  title: z.string().trim().min(1).max(120),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).strict() satisfies z.ZodType<CoachChat>;

export const labelAnalysisSchema = z.object({
  productName: z.string().trim().max(240).nullable(),
  brand: z.string().trim().max(240).nullable(),
  barcode: z.string().trim().max(64).nullable(),
  per100: nutritionSchema,
  servingSizeG: positiveFinite.nullable(),
  packageSizeG: positiveFinite.nullable(),
  confidence: z.enum(["low", "medium", "high"]),
  needsFollowUp: z.boolean(),
  followUpQuestions: z.array(z.string().trim().min(1).max(240)).max(3),
}).strict() satisfies z.ZodType<LabelAnalysis>;

export const mealPhotoAnalysisSchema = z.object({
  name: z.string().trim().min(1).max(240),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  amount: positiveFinite,
  unit: z.enum(["serving", "g", "100g", "package", "piece", "tbsp", "tsp", "ml"]),
  grams: positiveFinite,
  nutrition: nutritionSchema,
  components: z.array(z.string().trim().min(1).max(120)).max(20),
  confidence: z.enum(["low", "medium", "high"]),
}).strict() satisfies z.ZodType<MealPhotoAnalysis>;

export const publicRecipeSchema = z.object({
  id: z.string().trim().min(1).max(240),
  name: z.string().trim().min(1).max(240),
  servings: positiveFinite.max(100),
  servingGrams: positiveFinite.max(20_000),
  ingredients: z.array(recipeIngredientSchema).max(100),
  nutritionPerServing: nutritionSchema,
  imageUrl: z.string().trim().url().max(2_000).optional(),
  imageCredit: z.object({ label: z.string().trim().min(1).max(200), sourceUrl: z.string().trim().url().max(2_000) }).strict().optional(),
  source: z.enum(["community", "ai"]),
  authorId: z.string().uuid().optional(),
  instructions: z.array(z.string().trim().min(1).max(500)).max(30),
  cuisine: z.string().trim().max(60).optional(),
  dietaryTags: z.array(dietaryTagSchema).max(20),
  createdAt: z.string().datetime({ offset: true }),
}).strict() satisfies z.ZodType<PublicRecipe>;

/** Response from POST /api/recipes/estimate-nutrition. */
export const recipeNutritionEstimateSchema = z.object({
  nutritionPerServing: nutritionSchema,
  confidence: z.enum(["low", "medium", "high"]),
}).strict();

/** A single AI-rewritten catalogue candidate from POST /api/recipes/generate. */
export const generatedRecipeSchema = z.object({
  name: z.string().trim().min(1).max(240),
  servings: positiveFinite.max(100),
  servingGrams: positiveFinite.max(20_000),
  ingredients: z.array(z.string().trim().min(1).max(240)).min(1).max(30),
  nutritionPerServing: nutritionSchema,
  instructions: z.array(z.string().trim().min(1).max(500)).min(1).max(30),
}).strict();

export const coachMealActionSchema = z.object({
  name: z.string().trim().min(1).max(240),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  amount: positiveFinite,
  unit: z.enum(["serving", "g", "100g", "package", "piece", "tbsp", "tsp", "ml"]),
  grams: positiveFinite,
  nutrition: nutritionSchema,
  loggedDate: localDateSchema,
  estimated: z.boolean(),
}).strict() satisfies z.ZodType<CoachMealAction>;

export const coachMealChoiceSchema = z.object({
  label: z.string().trim().min(1).max(120),
  meal: coachMealActionSchema,
}).strict() satisfies z.ZodType<CoachMealChoice>;

export const backupSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().datetime({ offset: true }),
  meals: z.array(mealSchema).max(100_000),
  foods: z.array(foodSchema).max(100_000),
  profile: profileSchema.optional(),
  coachMessages: z.array(coachMessageSchema).max(100_000).optional(),
}).strict();

export type BackupSchemaData = z.infer<typeof backupSchema>;
