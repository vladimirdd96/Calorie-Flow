import { z } from "zod";
import type { CoachChat, CoachMessage, Food, LabelAnalysis, Meal, MealPhotoAnalysis, Nutrition, Profile } from "./types";

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

export const nutritionSchema = z.object({
  calories: finiteNonNegative,
  protein: finiteNonNegative,
  carbs: finiteNonNegative,
  fat: finiteNonNegative,
  fiber: finiteNonNegative,
  sugar: finiteNonNegative,
}).strict() satisfies z.ZodType<Nutrition>;

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
  source: z.enum(["seed", "open-food-facts", "food-data-central", "ai-label", "custom"]),
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
  loggedDate: localDateSchema.optional(),
  source: z.enum(["seed", "open-food-facts", "food-data-central", "ai-label", "custom"]),
  estimated: z.boolean().optional(),
}).strict() satisfies z.ZodType<Meal>;

export const profileSchema = z.object({
  name: z.string().trim().max(120),
  avatarUrl: optionalAvatar,
  sex: z.enum(["male", "female"]),
  age: z.number().int().min(16).max(100),
  heightCm: z.number().finite().min(120).max(230),
  weightKg: z.number().finite().min(35).max(300),
  activity: z.enum(["sedentary", "light", "moderate", "active", "very-active"]),
  goalMode: z.enum(["lose", "maintain", "gain"]),
  dietPreset: z.enum(["balanced", "high-protein", "keto", "high-protein-keto", "low-fat"]),
  calorieTarget: positiveFinite.max(20_000),
  proteinTarget: finiteNonNegative.max(2_000),
  carbsTarget: finiteNonNegative.max(2_000),
  fatTarget: finiteNonNegative.max(2_000),
  fiberTarget: finiteNonNegative.max(2_000),
  hideCalories: z.boolean(),
  onboardingDone: z.boolean(),
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

export const backupSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().datetime({ offset: true }),
  meals: z.array(mealSchema).max(100_000),
  foods: z.array(foodSchema).max(100_000),
  profile: profileSchema.optional(),
  coachMessages: z.array(coachMessageSchema).max(100_000).optional(),
}).strict();

export type BackupSchemaData = z.infer<typeof backupSchema>;
