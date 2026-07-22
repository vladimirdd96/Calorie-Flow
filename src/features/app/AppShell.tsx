"use client";
/* eslint-disable @next/next/no-img-element -- remote product thumbnails and local camera previews are dynamic user content. */

import { Check, Database } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BottomNav } from "@/features/navigation/BottomNav";
import { AuthGateway } from "@/features/auth/AuthGateway";
import { DiscoverView } from "@/features/food-catalogue/DiscoverView";
import { DailyNutritionBreakdown, MealImageViewer, NutritionDetails } from "@/features/diary/NutritionDetails";
import { Sheet } from "@/features/shared/Sheet";
import type { AddFoodView, AppTab } from "@/features/app/types";
import { exportData, getAll, getLocalSnapshot, getSetting, importData, initializeFoods, put, remove, replaceData, replaceLocalSnapshot, setSetting } from "@/lib/db";
import { clearCloudCoachMessages, deleteCloudMeal, getAllCloudCoachMessages, getCloudSnapshot, mergeSnapshots, pushCloudSnapshot, replaceCloudSnapshot, saveCloudCoachMessage, saveCloudCoachChat, upsertCloudFood, upsertCloudMeal, upsertCloudProfile } from "@/lib/cloud";
import { useAuth } from "@/hooks/useAuth";
import { localDateKey, sumNutrition } from "@/lib/nutrition";
import { syncAutomaticFastAfterMeal, syncAutomaticFasting } from "@/lib/fasting";
import { type CloudUser } from "@/lib/supabase";
import type { CoachMealAction, Food, Meal, MealPhotoAnalysis, MealType, Nutrition, Profile, Recipe } from "@/lib/types";
import { defaultHabitFeatures, fastingGoalHours, weightTrackingStatuses } from "@/lib/types";
import type { BackupData } from "@/lib/db";
import { CoachView } from "@/features/coach/CoachView";
import { TodayView, CalendarSheet, DuplicateMealSheet, MealEditor, MoveMealSheet, RecipeLogSheet } from "@/features/diary/DiaryView";
import { AddFoodSheet, PortionSheet } from "@/features/food-capture/FoodCapture";
import { InsightsView } from "@/features/insights/InsightsView";
import { PlanView } from "@/features/planning/PlanView";
import { MeasurementPreferencePrompt, OnboardingDialog, ProfileView, WeightTrackingPrompt } from "@/features/profile/ProfileView";

type Tab = AppTab;

type AddView = AddFoodView;

type SyncState = "local" | "syncing" | "synced" | "offline" | "error";

const themeModes = { light: "light", dark: "dark" } as const;

type ThemeMode = typeof themeModes[keyof typeof themeModes];

const chatTextSizes = { compact: "compact", comfortable: "comfortable", large: "large" } as const;

type ChatTextSize = typeof chatTextSizes[keyof typeof chatTextSizes];

const THEME_SETTING = "appearance:theme";

const CHAT_TEXT_SIZE_SETTING = "appearance:chat-text-size";

const HOME_SCREEN_PROMPT_SETTING = "homeScreenPromptCompleted";

function BrandMark({ large = false }: { large?: boolean }) {
  return <img className={`brand-mark${large ? " large" : ""}`} src="/icon.svg" alt="" aria-hidden="true" />;
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === themeModes.light || value === themeModes.dark;
}

function isChatTextSize(value: unknown): value is ChatTextSize {
  return value === chatTextSizes.compact || value === chatTextSizes.comfortable || value === chatTextSizes.large;
}

function isStandaloneDisplay() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent));
}

const DEFAULT_PROFILE: Profile = {
  name: "",
  sex: "male",
  age: 30,
  heightCm: 180,
  weightKg: 80,
  activity: "moderate",
  goalMode: "maintain",
  dietPreset: "balanced",
  calorieTarget: 2750,
  proteinTarget: 145,
  carbsTarget: 375,
  fatTarget: 70,
  fiberTarget: 30,
  hideCalories: false,
  onboardingDone: false,
  weightEntries: [],
  waterEntries: [],
  waterTargetMl: 2000,
  enabledHabitFeatures: [...defaultHabitFeatures],
  planEnabled: false,
  fastingGoalHours: 16,
  fastingRecords: [],
};

function accountDisplayName(user: CloudUser | null) {
  const candidates = [user?.user_metadata?.full_name, user?.user_metadata?.name];
  return candidates.find((candidate): candidate is string => typeof candidate === "string" && Boolean(candidate.trim()))?.trim();
}

const mealLabels: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

const compareMealOrder = (a: Meal, b: Meal) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) || a.createdAt.localeCompare(b.createdAt);

export function AppShell() {
  const auth = useAuth();
  const [ready, setReady] = useState(false);
  const [startupError, setStartupError] = useState("");
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [onboardingOrigin, setOnboardingOrigin] = useState<Profile>();
  const [foods, setFoods] = useState<Food[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [tab, setTab] = useState<Tab>("today");
  const [dateKey, setDateKey] = useState(localDateKey());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [initialAddView, setInitialAddView] = useState<AddView>("start");
  const [directFood, setDirectFood] = useState<Food>();
  const [editingMeal, setEditingMeal] = useState<Meal>();
  const [detailMeal, setDetailMeal] = useState<Meal>();
  const [duplicateMealDraft, setDuplicateMealDraft] = useState<Meal>();
  const [moveMealDraft, setMoveMealDraft] = useState<Meal>();
  const [initialMealType, setInitialMealType] = useState<MealType>();
  const [toast, setToast] = useState("");
  const [syncState, setSyncState] = useState<SyncState>("local");
  const [syncAttempt, setSyncAttempt] = useState(0);
  const [theme, setTheme] = useState<ThemeMode>(themeModes.light);
  const [chatTextSize, setChatTextSize] = useState<ChatTextSize>(chatTextSizes.comfortable);
  const [showHomeScreenPrompt, setShowHomeScreenPrompt] = useState(false);
  const [weightPromptDismissedFor, setWeightPromptDismissedFor] = useState<string | null>(null);
  const [undoMeal, setUndoMeal] = useState<{ meal: Meal; timerId: number }>();
  const [imageMeal, setImageMeal] = useState<Meal>();
  const [nutritionDetailsOpen, setNutritionDetailsOpen] = useState(false);
  const [recipeToLog, setRecipeToLog] = useState<Recipe>();
  const syncIdentityRef = useRef("");
  const syncMutationRef = useRef(0);
  const cloudWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const cloudWriteFailedRef = useRef(false);

  const refresh = useCallback(async () => {
    await initializeFoods();
    const [storedProfile, storedFoods, storedMeals] = await Promise.all([getSetting<Profile>("profile"), getAll<Food>("foods"), getAll<Meal>("meals")]);
    setProfile(storedProfile || DEFAULT_PROFILE); setFoods(storedFoods); setMeals(storedMeals); setStartupError(""); setReady(true);
  }, []);
  useEffect(() => {
    // IndexedDB is our external store; hydrate it once when the client mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh().catch(() => setStartupError("Your private diary could not be opened. Your data has not been reset."));
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const params = new URLSearchParams(window.location.search);
    if (params.has("scan")) { setInitialAddView("scan"); setAdding(true); }
    else if (params.has("add")) setAdding(true);
  }, [refresh]);
  useEffect(() => {
    let checking = false;
    const checkForDeploymentUpdate = async () => {
      if (checking || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const response = await fetch(`/?_calorie_flow_build=${Date.now()}`, { cache: "no-store", headers: { Accept: "text/html" } });
        if (!response.ok) return;
        const html = await response.text();
        const deployedBuild = html.match(/name=["']calorie-flow-build["'][^>]*content=["']([^"']+)["']/i)?.[1];
        const currentBuild = process.env.NEXT_PUBLIC_BUILD_ID || "development";
        if (deployedBuild && deployedBuild !== currentBuild) window.location.reload();
      } catch {
        // Deployment checks are best-effort and must not affect offline tracking.
      } finally {
        checking = false;
      }
    };
    const interval = window.setInterval(() => void checkForDeploymentUpdate(), 60_000);
    document.addEventListener("visibilitychange", checkForDeploymentUpdate);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", checkForDeploymentUpdate);
    };
  }, []);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2800); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    let active = true;
    getSetting<unknown>(THEME_SETTING).then((storedTheme) => {
      if (active && isThemeMode(storedTheme)) setTheme(storedTheme);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    getSetting<unknown>(CHAT_TEXT_SIZE_SETTING).then((storedSize) => {
      if (active && isChatTextSize(storedSize)) setChatTextSize(storedSize);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!ready || !isMobileDevice()) return;
    if (isStandaloneDisplay()) {
      void setSetting(HOME_SCREEN_PROMPT_SETTING, true);
      return;
    }
    let active = true;
    getSetting<boolean>(HOME_SCREEN_PROMPT_SETTING).then((completed) => {
      if (active) setShowHomeScreenPrompt(completed !== true);
    }).catch(() => {
      if (active) setShowHomeScreenPrompt(true);
    });
    return () => { active = false; };
  }, [ready]);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    const retry = () => { cloudWriteFailedRef.current = false; syncIdentityRef.current = ""; setSyncAttempt((value) => value + 1); };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);
  useEffect(() => {
    if (!ready || !auth.ready || !auth.user) return;
    const user = auth.user;
    const identity = `user:${user.id}`;
    if (syncIdentityRef.current === identity) return;
    syncIdentityRef.current = identity;
    let active = true;
    const synchronize = async () => {
      const mutationAtStart = syncMutationRef.current;
      const owner = await getSetting<string>("dataOwner");
      const userId = user.id;
      if (active) setSyncState("syncing");
      const [local, remote, dirty, tombstones] = await Promise.all([
        getLocalSnapshot(),
        getCloudSnapshot(userId),
        getSetting<boolean>(`cloudDirty:${userId}`),
        getSetting<string[]>(`deletedMealIds:${userId}`),
      ]);
      let next;
      let shouldPush = false;
      if (owner === identity && !dirty) {
        next = remote;
      } else if (owner === identity) {
        next = mergeSnapshots(remote, local);
        next.profile = local.profile || remote.profile;
        shouldPush = true;
      } else {
        next = mergeSnapshots(local, remote);
        shouldPush = true;
      }

      const accountName = accountDisplayName(user);
      if (accountName && !next.profile?.name.trim()) {
        next.profile = { ...(next.profile || DEFAULT_PROFILE), name: accountName };
        shouldPush = true;
      }

      const deletedIds = tombstones || [];
      if (deletedIds.length) {
        const deleted = new Set(deletedIds);
        next.meals = next.meals.filter((meal) => !deleted.has(meal.id));
        await Promise.all(deletedIds.map((id) => deleteCloudMeal(userId, id)));
        await setSetting(`deletedMealIds:${userId}`, []);
        shouldPush = true;
      }
      if (shouldPush) {
        if (mutationAtStart !== syncMutationRef.current) return;
        const mutationAtPush = syncMutationRef.current;
        await pushCloudSnapshot(userId, next);
        if (mutationAtPush === syncMutationRef.current) await setSetting(`cloudDirty:${userId}`, false);
      }
      if (mutationAtStart !== syncMutationRef.current) return;
      await replaceLocalSnapshot(next);
      await setSetting("dataOwner", identity);
      if (active) { cloudWriteFailedRef.current = false; await refresh(); setSyncState("synced"); }
    };
    synchronize().catch(() => {
      if (active) setSyncState(navigator.onLine ? "error" : "offline");
    });
    return () => { active = false; };
  }, [auth.configured, auth.ready, auth.user, ready, refresh, syncAttempt]);

  const dayMeals = useMemo(() => meals.filter((meal) => (meal.loggedDate || localDateKey(new Date(meal.createdAt))) === dateKey).sort(compareMealOrder), [meals, dateKey]);
  const syncWrite = (work: (userId: string) => Promise<void>) => {
    if (!auth.user) return;
    const userId = auth.user.id;
    const mutation = ++syncMutationRef.current;
    setSyncState("syncing");
    void setSetting(`cloudDirty:${userId}`, true)
      .then(() => {
        cloudWriteQueueRef.current = cloudWriteQueueRef.current.catch(() => undefined).then(() => work(userId));
        return cloudWriteQueueRef.current;
      })
      .then(async () => {
        if (mutation !== syncMutationRef.current || cloudWriteFailedRef.current) return;
        await setSetting(`cloudDirty:${userId}`, false);
        setSyncState("synced");
      })
      .catch(() => {
        cloudWriteFailedRef.current = true;
        setSyncState(navigator.onLine ? "error" : "offline");
      });
  };
  const saveProfile = async (next: Profile, announce = true) => {
    const synchronized = syncAutomaticFasting(next, meals);
    setProfile(synchronized); await setSetting("profile", synchronized); if (announce) setToast("Profile saved");
    syncWrite((userId) => upsertCloudProfile(userId, synchronized));
  };
  useEffect(() => {
    if (!ready) return;
    const synchronized = syncAutomaticFasting(profile, meals);
    if (synchronized === profile) return;
    const frame = window.requestAnimationFrame(() => void saveProfile(synchronized, false));
    // saveProfile intentionally captures the current local diary for the one-time backfill.
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, meals, profile]);
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
    const savedMeal = { ...meal, loggedDate, createdAt: adjustedDate.toISOString() };
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
    setMeals((current) => current.map((candidate) => candidate.id === savedMeal.id ? savedMeal : candidate));
    setEditingMeal(undefined); setToast("Meal updated");
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
    setMeals((current) => [...current, meal]); setEditingMeal(undefined); setToast(`${meal.name} logged`); setTab("today");
    void saveProfile(syncAutomaticFastAfterMeal(profile, meal), false);
    syncWrite((userId) => upsertCloudMeal(userId, meal));
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
    syncMutationRef.current += 1;
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
  const openAdd = (view: AddView = "start", mealType?: MealType) => { setInitialAddView(view); setInitialMealType(mealType); setAdding(true); };
  const selectFood = (food: Food) => { setInitialMealType(undefined); setDirectFood(food); setAdding(true); };
  const signOut = async () => { await auth.signOut(); };
  const changeTheme = (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    void setSetting(THEME_SETTING, nextTheme);
  };
  const changeChatTextSize = (nextSize: ChatTextSize) => {
    setChatTextSize(nextSize);
    void setSetting(CHAT_TEXT_SIZE_SETTING, nextSize);
  };
  const weightTrackingEnabled = profile.weightTracking === weightTrackingStatuses.enabled;
  const measurementPromptOpen = profile.onboardingDone && profile.measurementSystem === undefined;
  const weightPromptOpen = profile.onboardingDone && profile.weightTracking === undefined && weightPromptDismissedFor !== auth.user?.id;
  const enableWeightTracking = () => { setWeightPromptDismissedFor(auth.user?.id || ""); void saveProfile({ ...profile, weightTracking: weightTrackingStatuses.enabled }); };
  const disableWeightTracking = () => { void saveProfile({ ...profile, weightTracking: weightTrackingStatuses.disabled }); };
  const deferWeightTracking = () => setWeightPromptDismissedFor(auth.user?.id || "");

  const syncLabel: Record<SyncState, string> = {
    local: "Private on this device",
    syncing: "Syncing…",
    synced: "Synced privately",
    offline: "Saved offline",
    error: "Sync needs attention",
  };

  if (startupError) return <main className="app-loading load-error" role="alert"><Database size={30} /><h1>Diary unavailable</h1><p>{startupError}</p><button className="primary-button" onClick={() => { setStartupError(""); void refresh().catch(() => setStartupError("Your private diary could not be opened. Your data has not been reset.")); }}>Try again</button></main>;
  if (!ready || !auth.ready) return <div className="app-loading" role="status" aria-label="Opening your private diary"><BrandMark large /><i /></div>;
  if (auth.passwordRecovery || !auth.user) return <AuthGateway key={auth.passwordRecovery ? "recovery" : "sign-in"} configured={auth.configured} passwordRecovery={auth.passwordRecovery} onSignIn={auth.signInWithPassword} onSignUp={auth.signUp} onSignInWithProvider={auth.signInWithProvider} onRequestPasswordReset={auth.requestPasswordReset} onUpdatePassword={auth.updatePassword} />;
  const modalOpen = adding || !!editingMeal || !!detailMeal || !!imageMeal || !!duplicateMealDraft || !!moveMealDraft || !!recipeToLog || calendarOpen || nutritionDetailsOpen || !profile.onboardingDone || measurementPromptOpen || weightPromptOpen;
  return (
    <div className="app-shell">
      <div className="ambient one" /><div className="ambient two" />
      <div className="content-shell" inert={modalOpen} aria-hidden={modalOpen || undefined}>
        {tab === "today" && <TodayView profile={profile} meals={dayMeals} dateKey={dateKey} onDateChange={setDateKey} onAdd={(mealType) => openAdd("start", mealType)} onOpenCoach={() => setTab("coach")} onDelete={deleteMeal} onEdit={setEditingMeal} onOpenDetails={setDetailMeal} onOpenNutritionDetails={() => setNutritionDetailsOpen(true)} onOpenImage={setImageMeal} onDropMeal={dropMeal} onDuplicate={setDuplicateMealDraft} onMove={setMoveMealDraft} syncLabel={auth.user ? syncLabel[syncState] : "Private on this device"} showHomeScreenPrompt={showHomeScreenPrompt} onDismissHomeScreenPrompt={() => setShowHomeScreenPrompt(false)} onOpenCalendar={() => setCalendarOpen(true)} onSaveProfile={(next) => void saveProfile(next)} />}
        {tab === "search" && <DiscoverView foods={foods} recipes={profile.recipes || []} meals={meals} hideCalories={profile.hideCalories} onSelect={selectFood} onSelectRecipe={setRecipeToLog} onAdd={openAdd} />}
        {tab === "coach" && <CoachView configured={auth.configured} user={auth.user} hideCalories={profile.hideCalories} chatTextSize={chatTextSize} onLogCoachMeal={logCoachMeal} onOpenAccount={() => setTab("profile")} onOpenAdd={openAdd} />}
        {tab === "plan" && profile.planEnabled && <PlanView profile={profile} foods={foods} onSave={(next) => void saveProfile(next)} onLog={saveNewMeal} />}
        {tab === "insights" && <InsightsView meals={meals} profile={profile} onSave={saveProfile} weightTrackingEnabled={weightTrackingEnabled} />}
      {tab === "profile" && <ProfileView profile={profile} onSave={saveProfile} onRestartOnboarding={restartOnboarding} onExport={exportBackup} onImport={restoreBackup} user={auth.user} syncState={syncState} onSignOut={signOut} theme={theme} onThemeChange={changeTheme} chatTextSize={chatTextSize} onChatTextSizeChange={changeChatTextSize} weightTracking={profile.weightTracking} />}
      </div>
      <div inert={modalOpen} aria-hidden={modalOpen || undefined}><BottomNav planEnabled={profile.planEnabled ?? false} tab={tab} onChange={(nextTab) => { window.scrollTo(0, 0); setTab(nextTab); }} /></div>
      {adding && profile.onboardingDone && <Sheet onClose={() => { setAdding(false); setDirectFood(undefined); setInitialMealType(undefined); }} wide>{directFood ? <PortionSheet food={directFood} initialMealType={initialMealType} hideCalories={profile.hideCalories} onLog={logMeal} onClose={() => { setDirectFood(undefined); setAdding(false); }} /> : <AddFoodSheet foods={foods} hideCalories={profile.hideCalories} initialView={initialAddView} initialMealType={initialMealType} onLog={logMeal} onMealPhoto={addPhotoMeal} onSaveFood={saveFood} />}</Sheet>}
      {calendarOpen && <Sheet onClose={() => setCalendarOpen(false)} wide label="Calendar"><CalendarSheet dateKey={dateKey} meals={meals} profile={profile} onDateChange={setDateKey} onClose={() => setCalendarOpen(false)} /></Sheet>}
      {detailMeal && <Sheet onClose={() => setDetailMeal(undefined)} wide label={`Nutrition details for ${detailMeal.name}`}><NutritionDetails meal={detailMeal} hideCalories={profile.hideCalories} /></Sheet>}
      {imageMeal && imageMeal.imageUrl && <Sheet onClose={() => setImageMeal(undefined)} wide label={`Meal photo for ${imageMeal.name}`}><MealImageViewer meal={imageMeal} /></Sheet>}
      {nutritionDetailsOpen && <Sheet onClose={() => setNutritionDetailsOpen(false)} wide label="Today's nutrition details"><div className="daily-nutrition-sheet"><div className="sheet-header"><div><span className="eyebrow">Today</span><h2>Nutrition details</h2></div><span /></div><DailyNutritionBreakdown nutrition={sumNutrition(dayMeals.map((meal) => meal.nutrition))} hideCalories={profile.hideCalories} /></div></Sheet>}
      {recipeToLog && <Sheet onClose={() => setRecipeToLog(undefined)} label={`Log ${recipeToLog.name}`} wide><RecipeLogSheet recipe={recipeToLog} foods={foods} onLog={saveNewMeal} onClose={() => setRecipeToLog(undefined)} /></Sheet>}
      {editingMeal && <Sheet onClose={() => setEditingMeal(undefined)} label="Edit meal"><MealEditor meal={editingMeal} hideCalories={profile.hideCalories} onSave={(meal) => editingMeal.id.startsWith("photo-") ? saveNewMeal(meal) : saveEditedMeal(meal)} onClose={() => setEditingMeal(undefined)} /></Sheet>}
      {duplicateMealDraft && <Sheet onClose={() => setDuplicateMealDraft(undefined)} label="Duplicate meal" className="duplicate-meal-dialog"><DuplicateMealSheet meal={duplicateMealDraft} onDuplicate={(mealType) => void duplicateMeal(duplicateMealDraft, mealType)} onClose={() => setDuplicateMealDraft(undefined)} /></Sheet>}
      {moveMealDraft && <Sheet onClose={() => setMoveMealDraft(undefined)} label="Move meal" className="duplicate-meal-dialog"><MoveMealSheet meal={moveMealDraft} onMove={(mealType) => { void dropMeal(moveMealDraft, mealType); setMoveMealDraft(undefined); }} onClose={() => setMoveMealDraft(undefined)} /></Sheet>}
      {!profile.onboardingDone && <OnboardingDialog profile={profile} onSave={finishOnboarding} onCancel={onboardingOrigin ? cancelOnboarding : undefined} />}
      {measurementPromptOpen && <MeasurementPreferencePrompt profile={profile} onSave={saveProfile} />}
      {weightPromptOpen && !measurementPromptOpen && <WeightTrackingPrompt onEnable={enableWeightTracking} onDisable={disableWeightTracking} onDefer={deferWeightTracking} />}
      {undoMeal && <div className="toast undo-toast" role="status"><span>Meal removed</span><button type="button" onClick={undoDeleteMeal}>Undo</button></div>}
      {toast && <div className="toast"><Check size={17} />{toast}</div>}
    </div>
  );
}
