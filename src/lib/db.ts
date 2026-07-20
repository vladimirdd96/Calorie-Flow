import { seedFoods } from "./seed";
import type { Food, Meal, Profile } from "./types";
import type { CloudSnapshot } from "./cloud";
import { backupSchema, type BackupSchemaData } from "./schemas";

const DB_NAME = "calorie-flow";
const DB_VERSION = 1;

type StoreName = "meals" | "foods" | "settings";

export type BackupData = BackupSchemaData;

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
    let request: IDBRequest<T>;
    let result: T;
    let settled = false;
    const fail = (error: DOMException | null) => {
      if (settled) return;
      settled = true;
      db.close();
      reject(error || new DOMException("The local database transaction failed.", "UnknownError"));
    };
    try {
      request = operation(transaction.objectStore(storeName));
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => fail(request.error);
    } catch (error) {
      transaction.abort();
      db.close();
      reject(error);
      return;
    }
    transaction.oncomplete = () => {
      if (settled) return;
      settled = true;
      db.close();
      resolve(result);
    };
    transaction.onabort = () => fail(transaction.error);
  });
}

async function writeSnapshot(
  snapshot: Pick<CloudSnapshot, "meals" | "foods" | "profile">,
  mode: "merge" | "replace",
) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(["meals", "foods", "settings"], "readwrite");
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      db.close();
      reject(transaction.error || new DOMException("The local database transaction failed.", "UnknownError"));
    };
    try {
      const mealsStore = transaction.objectStore("meals");
      const foodsStore = transaction.objectStore("foods");
      const settingsStore = transaction.objectStore("settings");
      if (mode === "replace") {
        mealsStore.clear();
        foodsStore.clear();
      }
      snapshot.meals.forEach((meal) => mealsStore.put(meal));
      snapshot.foods.forEach((food) => foodsStore.put(food));
      if (snapshot.profile) settingsStore.put({ key: "profile", value: snapshot.profile });
      else if (mode === "replace") settingsStore.delete("profile");
    } catch (error) {
      transaction.abort();
      db.close();
      reject(error);
      return;
    }
    transaction.oncomplete = () => {
      if (settled) return;
      settled = true;
      db.close();
      resolve();
    };
    transaction.onerror = () => undefined;
    transaction.onabort = fail;
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
  await writeSnapshot(data, "merge");
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
  await writeSnapshot({ ...snapshot, foods: [...foods.values()] }, "replace");
}

export async function resetToGuestData() {
  await replaceLocalSnapshot({ meals: [], foods: seedFoods, profile: undefined });
  await setSetting("dataOwner", "guest");
}
