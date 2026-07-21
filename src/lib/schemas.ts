import { z } from "zod";
import type { CoachChat, CoachMealAction, CoachMealChoice, CoachMessage, DailyTargets, DiaryShare, FastingRecord, Food, LabelAnalysis, Meal, MealPhotoAnalysis, MealPlanEntry, Nutrition, Profile, Recipe, WaterEntry, WeightEntry } from "./types";

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
const mealPlanEntrySchema = z.object({ id: z.string().trim().min(1).max(240), recipeId: z.string().trim().min(1).max(240), date: localDateSchema, mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]) }).strict() satisfies z.ZodType<MealPlanEntry>;
const dailyTargetsSchema = z.object({ calories: positiveFinite.max(20_000), protein: finiteNonNegative.max(2_000), carbs: finiteNonNegative.max(2_000), fat: finiteNonNegative.max(2_000), fiber: finiteNonNegative.max(2_000) }).strict() satisfies z.ZodType<DailyTargets>;

export const nutritionSchema = z.object({
  calories: finiteNonNegative,
  protein: finiteNonNegative,
  carbs: finiteNonNegative,
  fat: finiteNonNegative,
  fiber: finiteNonNegative,
  sugar: finiteNonNegative,
  micronutrients: z.object({
    sodiumMg: finiteNonNegative, cholesterolMg: finiteNonNegative, saturatedFatG: finiteNonNegative,
    potassiumMg: finiteNonNegative, calciumMg: finiteNonNegative, ironMg: finiteNonNegative,
    magnesiumMg: finiteNonNegative, zincMg: finiteNonNegative, vitaminAMcg: finiteNonNegative,
    vitaminCMg: finiteNonNegative, vitaminDMcg: finiteNonNegative, vitaminEMg: finiteNonNegative,
    vitaminKMcg: finiteNonNegative, vitaminB12Mcg: finiteNonNegative, folateMcg: finiteNonNegative,
  }).strict().optional(),
}).strict() satisfies z.ZodType<Nutrition>;

const recipeSchema = z.object({ id: z.string().trim().min(1).max(240), name: z.string().trim().min(1).max(240), servings: positiveFinite.max(100), ingredients: z.array(z.object({ id: z.string().trim().min(1).max(240), name: z.string().trim().min(1).max(240) }).strict()).max(100), nutritionPerServing: nutritionSchema, createdAt: z.string().datetime({ offset: true }), updatedAt: z.string().datetime({ offset: true }) }).strict() satisfies z.ZodType<Recipe>;

export const foodSchema = z.object({
  id: z.string().trim().min(1).max(240),
  name: z.string().trim().min(1).max(240),
  brand: optionalShortText,
  barcode: z.string().trim().max(64).optional(),
  imageUrl: z.string().url().max(2_048).optional(),
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
  hideCalories: z.boolean(),
  onboardingDone: z.boolean(),
  measurementSystem: z.enum(["metric", "imperial"]).optional(),
  weightEntries: z.array(weightEntrySchema).max(10_000).optional(),
  weightTracking: z.enum(["enabled", "disabled"]).optional(),
  dailyTargets: z.object({ monday: dailyTargetsSchema.optional(), tuesday: dailyTargetsSchema.optional(), wednesday: dailyTargetsSchema.optional(), thursday: dailyTargetsSchema.optional(), friday: dailyTargetsSchema.optional(), saturday: dailyTargetsSchema.optional(), sunday: dailyTargetsSchema.optional() }).strict().optional(),
  mealCalorieTargets: z.object({ breakfast: positiveFinite.max(20_000).optional(), lunch: positiveFinite.max(20_000).optional(), dinner: positiveFinite.max(20_000).optional(), snack: positiveFinite.max(20_000).optional() }).strict().optional(),
  carbDisplay: z.enum(["total", "net"]).optional(),
  waterTargetMl: z.number().finite().int().min(250).max(20_000).optional(),
  waterEntries: z.array(waterEntrySchema).max(10_000).optional(),
  fastingGoalHours: z.union([z.literal(12), z.literal(14), z.literal(16)]).optional(),
  fastingRecords: z.array(fastingRecordSchema).max(10_000).optional(),
  recipes: z.array(recipeSchema).max(10_000).optional(),
  mealPlanEntries: z.array(mealPlanEntrySchema).max(100_000).optional(),
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
