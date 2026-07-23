"use client";
import type { Dispatch, SetStateAction } from "react";
import { clearCloudCoachMessages, deleteCloudMeal, getAllCloudCoachMessages, getCloudSnapshot, mergeSnapshots, pushCloudSnapshot, replaceCloudSnapshot, saveCloudCoachChat, saveCloudCoachMessage, upsertCloudFood, upsertCloudMeal } from "@/lib/cloud";
import { exportData, getAll, getLocalSnapshot, getSetting, importData, put, remove, replaceData, setSetting } from "@/lib/db";
import { syncAutomaticFastAfterMeal } from "@/lib/fasting";
import { localDateKey } from "@/lib/nutrition";
import type { BackupData } from "@/lib/db";
import type { AddFoodView } from "@/features/food-capture/types";
import type { CloudUser } from "@/lib/supabase";
import type { CoachMealAction, Food, Meal, MealPhotoAnalysis, MealType, Profile, Recipe } from "@/lib/types";

const mealLabels: Record<MealType, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };
const compareMealOrder = (left: Meal, right: Meal) => (left.position ?? Number.MAX_SAFE_INTEGER) - (right.position ?? Number.MAX_SAFE_INTEGER) || left.createdAt.localeCompare(right.createdAt);

/** Persists diary mutations locally first, then queues optional cloud writes. */
type Dependencies = {
  auth: { user: CloudUser | null };
  profile: Profile; foods: Food[]; meals: Meal[]; dateKey: string; onboardingOrigin?: Profile; undoMeal?: { meal: Meal; timerId: number };
  setFoods: Dispatch<SetStateAction<Food[]>>; setMeals: Dispatch<SetStateAction<Meal[]>>; setOnboardingOrigin: Dispatch<SetStateAction<Profile | undefined>>; setUndoMeal: Dispatch<SetStateAction<{ meal: Meal; timerId: number } | undefined>>;
  setAdding: Dispatch<SetStateAction<boolean>>; setDirectFood: Dispatch<SetStateAction<Food | undefined>>; setInitialMealType: Dispatch<SetStateAction<MealType | undefined>>; setInitialAddView: Dispatch<SetStateAction<AddFoodView>>; setDateKey: Dispatch<SetStateAction<string>>; setToast: Dispatch<SetStateAction<string>>; setTab: Dispatch<SetStateAction<"today" | "search" | "coach" | "plan" | "insights" | "profile">>; setEditingMeal: Dispatch<SetStateAction<Meal | undefined>>; setDuplicateMealDraft: Dispatch<SetStateAction<Meal | undefined>>;
  saveProfile: (profile: Profile, announce?: boolean) => Promise<void>; syncWrite: (work: (userId: string) => Promise<void>) => void; markSyncMutation: () => void; refresh: () => Promise<void>;
};

export function useTrackerActions(dependencies: Dependencies) {
  const { auth, profile, foods, meals, dateKey, onboardingOrigin, undoMeal, setFoods, setMeals, setOnboardingOrigin, setUndoMeal, setAdding, setDirectFood, setInitialMealType, setInitialAddView, setDateKey, setToast, setTab, setEditingMeal, setDuplicateMealDraft, saveProfile, syncWrite, markSyncMutation, refresh } = dependencies;
  const saveLinkedFoodPhotos = async (photos: Array<{ foodId?: string; imageUrl?: string }>) => {
    const updates = new Map<string, Food>();
    photos.forEach(({ foodId, imageUrl }) => {
      if (!foodId || !imageUrl) return;
      const food = foods.find((candidate) => candidate.id === foodId);
      if (food) updates.set(food.id, { ...food, imageUrl });
    });
    if (!updates.size) return;
    await Promise.all([...updates.values()].map((food) => put("foods", food)));
    setFoods((current) => current.map((food) => updates.get(food.id) || food));
    syncWrite((userId) => Promise.all([...updates.values()].map((food) => upsertCloudFood(userId, food))).then(() => undefined));
  };
  const restartOnboarding = () => {
    setOnboardingOrigin(profile);
    void saveProfile({ ...profile, onboardingDone: false });
  };
  const finishOnboarding = (next: Profile) => {
    setOnboardingOrigin(undefined);
    void saveProfile(next);
  };
  const cancelOnboarding = () => {
    if (!onboardingOrigin) return;
    const previousProfile = onboardingOrigin;
    setOnboardingOrigin(undefined);
    void saveProfile(previousProfile);
  };
  const logMeal = async (meal: Meal, food: Food) => {
    const loggedDate = meal.loggedDate || dateKey;
    const adjustedDate = loggedDate === localDateKey() ? new Date() : new Date(`${loggedDate}T12:00:00`);
    const savedMeal = { ...meal, imageUrl: meal.imageUrl || food.imageUrl, loggedDate, createdAt: adjustedDate.toISOString() };
    await Promise.all([put("meals", savedMeal), put("foods", food)]);
    setMeals((current) => [...current, savedMeal]);
    setFoods((current) => [food, ...current.filter((item) => item.id !== food.id)]);
    void saveProfile(syncAutomaticFastAfterMeal(profile, savedMeal), false);
    setAdding(false); setDirectFood(undefined); setInitialMealType(undefined); setDateKey(loggedDate); setToast(`${food.name} logged`); setTab("today");
    syncWrite(async (userId) => { await Promise.all([upsertCloudMeal(userId, savedMeal), upsertCloudFood(userId, food)]); });
  };
  const saveFood = async (food: Food) => {
    await put("foods", food);
    setFoods((current) => [food, ...current.filter((item) => item.id !== food.id)]);
    syncWrite((userId) => upsertCloudFood(userId, food));
  };
  const saveEditedMeal = async (meal: Meal) => {
    const savedMeal = { ...meal, loggedDate: meal.loggedDate || dateKey };
    await put("meals", savedMeal);
    await saveLinkedFoodPhotos([savedMeal]);
    setMeals((current) => current.map((candidate) => candidate.id === savedMeal.id ? savedMeal : candidate));
    setEditingMeal(undefined); setToast("Meal updated");
    syncWrite((userId) => upsertCloudMeal(userId, savedMeal));
  };
  const saveEditedRecipe = async (meal: Meal, recipe: Recipe) => {
    const savedMeal = { ...meal, loggedDate: meal.loggedDate || dateKey };
    await put("meals", savedMeal);
    await saveLinkedFoodPhotos(recipe.ingredients.map((ingredient) => ({ foodId: ingredient.foodId, imageUrl: savedMeal.imageUrl || recipe.imageUrls?.[0] })));
    await saveProfile({ ...profile, recipes: (profile.recipes || []).map((candidate) => candidate.id === recipe.id ? recipe : candidate) }, false);
    setMeals((current) => current.map((candidate) => candidate.id === savedMeal.id ? savedMeal : candidate));
    setEditingMeal(undefined); setToast("Recipe updated");
    syncWrite((userId) => upsertCloudMeal(userId, savedMeal));
  };
  const dropMeal = async (meal: Meal, mealType: MealType, targetMealId?: string, insertAfter = false) => {
    const dayMeals = meals.filter((candidate) => (candidate.loggedDate || localDateKey(new Date(candidate.createdAt))) === dateKey).sort(compareMealOrder);
    const nextByType = new Map<MealType, Meal[]>((Object.keys(mealLabels) as MealType[]).map((type) => [type, dayMeals.filter((candidate) => candidate.mealType === type && candidate.id !== meal.id)]));
    const destination = nextByType.get(mealType) || [];
    const targetIndex = targetMealId ? destination.findIndex((candidate) => candidate.id === targetMealId) : -1;
    destination.splice(targetIndex < 0 ? destination.length : targetIndex + (insertAfter ? 1 : 0), 0, { ...meal, mealType, loggedDate: meal.loggedDate || dateKey });
    nextByType.set(mealType, destination);
    const changed = [...nextByType.values()].flat().map((candidate, index) => ({ ...candidate, position: nextByType.get(candidate.mealType)?.findIndex((item) => item.id === candidate.id) ?? index }));
    await Promise.all(changed.map((candidate) => put("meals", candidate)));
    setMeals((current) => current.map((candidate) => changed.find((next) => next.id === candidate.id) || candidate));
    syncWrite((userId) => Promise.all(changed.map((candidate) => upsertCloudMeal(userId, candidate))).then(() => undefined));
    setToast(meal.mealType === mealType ? "Meal order updated" : `Moved to ${mealLabels[mealType]}`);
  };
  const duplicateMeal = async (meal: Meal, mealType: MealType) => {
    const destinationMeals = meals.filter((candidate) => (candidate.loggedDate || localDateKey(new Date(candidate.createdAt))) === dateKey && candidate.mealType === mealType).sort(compareMealOrder);
    const copy: Meal = { ...meal, id: `duplicate-${crypto.randomUUID()}`, mealType, loggedDate: meal.loggedDate || dateKey, createdAt: new Date().toISOString(), position: destinationMeals.length };
    await put("meals", copy);
    setMeals((current) => [...current, copy]);
    void saveProfile(syncAutomaticFastAfterMeal(profile, copy), false);
    syncWrite((userId) => upsertCloudMeal(userId, copy));
    setDuplicateMealDraft(undefined);
    setToast(`Copied to ${mealLabels[mealType]}`);
  };
  const saveNewMeal = async (meal: Meal) => {
    await put("meals", meal);
    if (meal.recipeId) {
      const recipe = profile.recipes?.find((candidate) => candidate.id === meal.recipeId);
      if (recipe) await saveLinkedFoodPhotos(recipe.ingredients.map((ingredient) => ({ foodId: ingredient.foodId, imageUrl: meal.imageUrl || recipe.imageUrls?.[0] })));
    } else {
      await saveLinkedFoodPhotos([meal]);
    }
    setMeals((current) => [...current, meal]); setEditingMeal(undefined); setToast(`${meal.name} logged`); setTab("today");
    void saveProfile(syncAutomaticFastAfterMeal(profile, meal), false);
    syncWrite((userId) => upsertCloudMeal(userId, meal));
  };
  const packageRecipe = async (recipe: Recipe, components: Meal[]) => {
    const componentIds = new Set(components.map((meal) => meal.id));
    const recipeMeal: Meal = {
      id: `recipe-${crypto.randomUUID()}`,
      recipeId: recipe.id,
      recipeLogId: `recipe-log-${crypto.randomUUID()}`,
      name: recipe.name,
      mealType: components[0]?.mealType || "breakfast",
      amount: 1,
      unit: "serving",
      grams: 100,
      nutrition: recipe.nutritionPerServing,
      imageUrl: recipe.imageUrls?.[0],
      createdAt: new Date().toISOString(),
      loggedDate: dateKey,
      source: "custom",
    };
    await Promise.all([...components.map((meal) => remove("meals", meal.id)), put("meals", recipeMeal)]);
    await saveLinkedFoodPhotos(recipe.ingredients.map((ingredient) => ({ foodId: ingredient.foodId, imageUrl: recipe.imageUrls?.[0] })));
    await saveProfile({ ...profile, recipes: [...(profile.recipes || []), recipe] }, false);
    setMeals((current) => [...current.filter((meal) => !componentIds.has(meal.id)), recipeMeal]);
    setToast(`${recipe.name} saved and packaged`);
    syncWrite(async (userId) => {
      await Promise.all([...components.map((meal) => deleteCloudMeal(userId, meal.id)), upsertCloudMeal(userId, recipeMeal)]);
    });
  };
  const logCoachMeal = async (action: CoachMealAction) => {
    const meal: Meal = {
      id: `coach-${crypto.randomUUID()}`,
      name: action.name,
      mealType: action.mealType,
      amount: action.amount,
      unit: action.unit,
      grams: action.grams,
      nutrition: action.nutrition,
      createdAt: new Date(`${action.loggedDate}T12:00:00`).toISOString(),
      loggedDate: action.loggedDate,
      source: "custom",
      estimated: action.estimated,
    };
    // Mark the mutation before the async IndexedDB write so an initial cloud
    // snapshot cannot replace this meal during the write window.
    markSyncMutation();
    await put("meals", meal);
    const storedMeals = await getAll<Meal>("meals");
    if (!storedMeals.some((candidate) => candidate.id === meal.id)) throw new Error("The meal was not written to the local diary.");
    setMeals((current) => [...current, meal]);
    void saveProfile(syncAutomaticFastAfterMeal(profile, meal), false);
    setDateKey(action.loggedDate);
    setTab("today");
    setToast(`${meal.name} logged`);
    syncWrite((userId) => upsertCloudMeal(userId, meal));
  };
  const addPhotoMeal = (analysis: MealPhotoAnalysis) => {
    const details = analysis.components.length ? ` · ${analysis.components.join(", ")}` : "";
    const meal: Meal = { id: `photo-${crypto.randomUUID()}`, name: `${analysis.name}${details}`.slice(0, 240), mealType: analysis.mealType, amount: analysis.amount, unit: analysis.unit, grams: analysis.grams, nutrition: analysis.nutrition, createdAt: new Date().toISOString(), loggedDate: dateKey, source: "custom", estimated: analysis.confidence !== "high" };
    setAdding(false); setEditingMeal(meal);
  };
  const deleteMeal = async (id: string) => {
    const deletedMeal = meals.find((meal) => meal.id === id);
    if (!deletedMeal) return;
    await remove("meals", id); setMeals((current) => current.filter((meal) => meal.id !== id)); setToast("");
    let deletionKey: string | undefined;
    if (auth.user) {
      deletionKey = `deletedMealIds:${auth.user.id}`;
      const current = await getSetting<string[]>(deletionKey) || [];
      await setSetting(deletionKey, [...new Set([...current, id])]);
    }
    const timerId = window.setTimeout(() => {
      setUndoMeal((pending) => pending?.meal.id === id ? undefined : pending);
      setToast("Meal removed");
      if (deletionKey) syncWrite(async (userId) => {
        await deleteCloudMeal(userId, id);
        const remaining = (await getSetting<string[]>(deletionKey) || []).filter((mealId) => mealId !== id);
        await setSetting(deletionKey, remaining);
      });
    }, 6000);
    setUndoMeal({ meal: deletedMeal, timerId });
  };
  const undoDeleteMeal = async () => {
    if (!undoMeal) return;
    const { meal, timerId } = undoMeal;
    window.clearTimeout(timerId);
    setUndoMeal(undefined);
    await put("meals", meal);
    setMeals((current) => [...current.filter((candidate) => candidate.id !== meal.id), meal]);
    if (auth.user) {
      const key = `deletedMealIds:${auth.user.id}`;
      await setSetting(key, (await getSetting<string[]>(key) || []).filter((mealId) => mealId !== meal.id));
      syncWrite((userId) => upsertCloudMeal(userId, meal));
    }
    setToast("Meal restored");
  };
  const exportBackup = async (): Promise<BackupData> => {
    const local = await exportData();
    if (!auth.user) return local;
    const [remote, coachMessages] = await Promise.all([getCloudSnapshot(auth.user.id), getAllCloudCoachMessages(auth.user.id)]);
    const merged = mergeSnapshots({ profile: local.profile, meals: local.meals, foods: local.foods }, remote);
    return { ...local, ...merged, coachMessages };
  };
  const restoreBackup = async (data: BackupData, mode: "merge" | "replace") => {
    if (mode === "replace") await replaceData(data);
    else await importData(data);
    await refresh(); setToast(mode === "replace" ? "Backup replaced current data" : "Backup restored");
    if (auth.user) syncWrite(async (userId) => {
      if (mode === "replace") await clearCloudCoachMessages(userId);
      const importedChats = [...new Set((data.coachMessages || []).map((message) => message.chatId))].map((chatId) => {
        const firstMessage = data.coachMessages?.find((message) => message.chatId === chatId);
        const createdAt = firstMessage?.createdAt || new Date().toISOString();
        return { id: chatId, title: "Restored conversation", createdAt, updatedAt: createdAt };
      });
      await Promise.all([
        mode === "replace" ? replaceCloudSnapshot(userId, await getLocalSnapshot()) : pushCloudSnapshot(userId, await getLocalSnapshot()),
        ...importedChats.map((chat) => saveCloudCoachChat(userId, chat)),
        ...((data.coachMessages || []).map((message) => saveCloudCoachMessage(userId, message))),
      ]);
    });
  };
  const openAdd = (view: AddFoodView = "start", mealType?: MealType) => { setInitialAddView(view); setInitialMealType(mealType); setAdding(true); };
  const selectFood = (food: Food) => { setInitialMealType(undefined); setDirectFood(food); setAdding(true); };

  return { restartOnboarding, finishOnboarding, cancelOnboarding, logMeal, saveFood, saveEditedMeal, saveEditedRecipe, dropMeal, duplicateMeal, saveNewMeal, packageRecipe, logCoachMeal, addPhotoMeal, deleteMeal, undoDeleteMeal, exportBackup, restoreBackup, openAdd, selectFood };
}
