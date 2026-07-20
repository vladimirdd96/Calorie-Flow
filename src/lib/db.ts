import { seedFoods } from "./seed";
import type { CoachMessage, Food, Meal, Profile } from "./types";
import type { CloudSnapshot } from "./cloud";
import { z } from "zod";

const DB_NAME = "calorie-flow";
const DB_VERSION = 1;

type StoreName = "meals" | "foods" | "settings";

export type BackupData = {
  version: 1;
  exportedAt: string;
  meals: Meal[];
  foods: Food[];
  profile?: Profile;
  coachMessages?: CoachMessage[];
};

const nutritionSchema = z.object({
  calories: z.number(), protein: z.number(), carbs: z.number(), fat: z.number(), fiber: z.number(), sugar: z.number(),
});
const foodSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), brand: z.string().optional(), barcode: z.string().optional(), imageUrl: z.string().optional(),
  quantityLabel: z.string().optional(), servingGrams: z.number().optional(), servingLabel: z.string().optional(), packageGrams: z.number().optional(), pieceGrams: z.number().optional(),
  nutrientsPer100: nutritionSchema, source: z.enum(["seed", "open-food-facts", "ai-label", "custom"]), verified: z.boolean().optional(), lastUsedAt: z.string().optional(),
});
const mealSchema = z.object({
  id: z.string().min(1), foodId: z.string().optional(), name: z.string().min(1), brand: z.string().optional(), mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  amount: z.number(), unit: z.enum(["serving", "g", "100g", "package", "piece", "tbsp", "tsp", "ml"]), grams: z.number(), nutrition: nutritionSchema,
  createdAt: z.string().min(1), source: z.enum(["seed", "open-food-facts", "ai-label", "custom"]), estimated: z.boolean().optional(),
});
const profileSchema = z.object({
  name: z.string(), sex: z.enum(["male", "female"]), age: z.number(), heightCm: z.number(), weightKg: z.number(), activity: z.enum(["sedentary", "light", "moderate", "active", "very-active"]),
  goalMode: z.enum(["lose", "maintain", "gain"]), dietPreset: z.enum(["balanced", "high-protein", "keto", "high-protein-keto", "low-fat"]),
  calorieTarget: z.number(), proteinTarget: z.number(), carbsTarget: z.number(), fatTarget: z.number(), fiberTarget: z.number(), hideCalories: z.boolean(), onboardingDone: z.boolean(),
});
const backupSchema = z.object({
  version: z.literal(1), exportedAt: z.string().min(1), meals: z.array(mealSchema), foods: z.array(foodSchema), profile: profileSchema.optional(),
  coachMessages: z.array(z.object({ id: z.string().min(1), role: z.enum(["user", "assistant"]), content: z.string(), createdAt: z.string().min(1) })).optional(),
});

export function validateBackup(data: unknown): BackupData {
  return backupSchema.parse(data);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("meals")) {
        const meals = db.createObjectStore("meals", { keyPath: "id" });
        meals.createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains("foods")) {
        const foods = db.createObjectStore("foods", { keyPath: "id" });
        foods.createIndex("barcode", "barcode", { unique: false });
        foods.createIndex("lastUsedAt", "lastUsedAt");
      }
      if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact<T>(storeName: StoreName, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function initializeFoods() {
  const existing = await getAll<Food>("foods");
  if (existing.length === 0) await Promise.all(seedFoods.map((food) => put("foods", food)));
}

export async function put<T>(store: StoreName, value: T) {
  await transact(store, "readwrite", (objectStore) => objectStore.put(value));
}

export async function remove(store: StoreName, key: IDBValidKey) {
  await transact(store, "readwrite", (objectStore) => objectStore.delete(key));
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  return transact<T[]>(store, "readonly", (objectStore) => objectStore.getAll());
}

export async function clearStore(store: StoreName) {
  await transact(store, "readwrite", (objectStore) => objectStore.clear());
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const row = await transact<{ key: string; value: T } | undefined>("settings", "readonly", (store) => store.get(key));
  return row?.value;
}

export async function setSetting<T>(key: string, value: T) {
  await put("settings", { key, value });
}

export async function exportData() {
  const [meals, foods, profile] = await Promise.all([
    getAll<Meal>("meals"),
    getAll<Food>("foods"),
    getSetting<Profile>("profile"),
  ]);
  return {
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    meals,
    foods: foods.filter((food) => food.source !== "seed" || Boolean(food.lastUsedAt)),
    profile,
  };
}

export async function importData(data: Pick<BackupData, "meals" | "foods" | "profile">) {
  await Promise.all([
    ...(data.meals || []).map((meal) => put("meals", meal)),
    ...(data.foods || []).map((food) => put("foods", food)),
  ]);
  if (data.profile) await setSetting("profile", data.profile);
}

export async function replaceData(data: Pick<BackupData, "meals" | "foods" | "profile">) {
  await replaceLocalSnapshot(data);
}

export async function getLocalSnapshot(): Promise<CloudSnapshot> {
  const [meals, foods, profile] = await Promise.all([
    getAll<Meal>("meals"),
    getAll<Food>("foods"),
    getSetting<Profile>("profile"),
  ]);
  return { meals, foods, profile };
}

export async function replaceLocalSnapshot(snapshot: CloudSnapshot) {
  const foods = new Map(seedFoods.map((food) => [food.id, food]));
  snapshot.foods.forEach((food) => foods.set(food.id, food));
  await Promise.all([clearStore("meals"), clearStore("foods")]);
  await Promise.all([
    ...snapshot.meals.map((meal) => put("meals", meal)),
    ...[...foods.values()].map((food) => put("foods", food)),
  ]);
  if (snapshot.profile) await setSetting("profile", snapshot.profile);
  else await remove("settings", "profile");
}

export async function resetToGuestData() {
  await replaceLocalSnapshot({ meals: [], foods: seedFoods, profile: undefined });
  await setSetting("dataOwner", "guest");
}
