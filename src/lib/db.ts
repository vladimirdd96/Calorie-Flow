import { seedFoods } from "./seed";
import type { Food, Meal, Profile } from "./types";
import type { CloudSnapshot } from "./cloud";

const DB_NAME = "calorie-flow";
const DB_VERSION = 1;

type StoreName = "meals" | "foods" | "settings";

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
  return { version: 1, exportedAt: new Date().toISOString(), meals, foods, profile };
}

export async function importData(data: { meals?: Meal[]; foods?: Food[]; profile?: Profile }) {
  await Promise.all([
    ...(data.meals || []).map((meal) => put("meals", meal)),
    ...(data.foods || []).map((food) => put("foods", food)),
  ]);
  if (data.profile) await setSetting("profile", data.profile);
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
