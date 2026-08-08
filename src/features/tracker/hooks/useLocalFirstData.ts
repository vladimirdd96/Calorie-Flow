"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { deleteCloudMeal, getCloudSnapshot, mergeSnapshots, pushCloudSnapshot, upsertCloudProfile } from "@/lib/cloud";
import { getAll, getLocalSnapshot, getSetting, initializeFoods, replaceLocalSnapshot, setSetting } from "@/lib/db";
import { syncAutomaticFasting } from "@/lib/fasting";
import { normalizeCalorieTarget, normalizeNutritionTargets } from "@/lib/nutrition";
import { getSupabase, type CloudUser } from "@/lib/supabase";
import type { Food, Meal, Profile } from "@/lib/types";
import { currentTargetModelVersion, defaultHabitFeatures } from "@/lib/types";

type SyncState = "local" | "syncing" | "synced" | "offline" | "error";
const themeModes = { light: "light", dark: "dark" } as const;
type ThemeMode = typeof themeModes[keyof typeof themeModes];
const chatTextSizes = { compact: "compact", comfortable: "comfortable", large: "large" } as const;
type ChatTextSize = typeof chatTextSizes[keyof typeof chatTextSizes];
const THEME_SETTING = "appearance:theme";
const CHAT_TEXT_SIZE_SETTING = "appearance:chat-text-size";
const HOME_SCREEN_PROMPT_SETTING = "homeScreenPromptCompleted";
const syncRetryDelaysMs = [2_000, 5_000, 15_000] as const;
const DEFAULT_PROFILE: Profile = { name: "", sex: "male", age: 30, heightCm: 180, weightKg: 80, activity: "moderate", goalMode: "maintain", dietPreset: "balanced", calorieTarget: 2750, proteinTarget: 145, carbsTarget: 375, fatTarget: 70, fiberTarget: 30, sugarTarget: 50, saturatedFatTarget: 20, sodiumTarget: 2300, potassiumTarget: 3500, hideCalories: false, onboardingDone: false, weightEntries: [], waterEntries: [], waterTargetMl: 2000, enabledHabitFeatures: [...defaultHabitFeatures], planEnabled: true, fastingGoalHours: 16, fastingRecords: [], targetModelVersion: currentTargetModelVersion };
const isThemeMode = (value: unknown): value is ThemeMode => value === themeModes.light || value === themeModes.dark;
const isChatTextSize = (value: unknown): value is ChatTextSize => value === chatTextSizes.compact || value === chatTextSizes.comfortable || value === chatTextSizes.large;
const isStandaloneDisplay = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isMobileDevice = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent));
const accountDisplayName = (user: CloudUser | null) => [user?.user_metadata?.full_name, user?.user_metadata?.name].find((candidate): candidate is string => typeof candidate === "string" && Boolean(candidate.trim()))?.trim();

type UiEffects = { setAdding: (open: boolean) => void; setInitialAddView: (view: "start" | "scan") => void; setShowHomeScreenPrompt: (open: boolean) => void; setToast: (message: string) => void };
type Auth = { configured: boolean; ready: boolean; user: CloudUser | null };

/** Owns local hydration, optional cloud synchronization, and persisted preferences. */
export function useLocalFirstData(auth: Auth, ui: UiEffects) {
  const { setAdding, setInitialAddView, setShowHomeScreenPrompt, setToast } = ui;
  const [ready, setReady] = useState(false);
  const [startupError, setStartupError] = useState("");
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [onboardingOrigin, setOnboardingOrigin] = useState<Profile>();
  const [foods, setFoods] = useState<Food[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [syncState, setSyncState] = useState<SyncState>("local");
  const [syncAttempt, setSyncAttempt] = useState(0);
  const [theme, setTheme] = useState<ThemeMode>(themeModes.light);
  const [chatTextSize, setChatTextSize] = useState<ChatTextSize>(chatTextSizes.comfortable);
  const syncIdentityRef = useRef("");
  const syncMutationRef = useRef(0);
  const cloudWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const cloudWriteFailedRef = useRef(false);
  const remoteDeletedMealIdsRef = useRef(new Set<string>());
  const cloudSyncInFlightRef = useRef(false);
  const cloudSyncQueuedRef = useRef(false);
  const cloudWriteInFlightRef = useRef(false);
  const suppressRealtimeSyncUntilRef = useRef(0);
  const syncRetryCountRef = useRef(0);
  const syncRetryTimerRef = useRef<number | undefined>(undefined);

  const requestCloudSync = useCallback(() => {
    if (cloudSyncInFlightRef.current) {
      cloudSyncQueuedRef.current = true;
      return;
    }
    syncIdentityRef.current = "";
    setSyncAttempt((value) => value + 1);
  }, []);
  const retryCloudSync = useCallback(() => {
    cloudWriteFailedRef.current = false;
    syncRetryCountRef.current = 0;
    requestCloudSync();
  }, [requestCloudSync]);
  const scheduleCloudRetry = useCallback(() => {
    if (!navigator.onLine || syncRetryTimerRef.current !== undefined) return;
    const delay = syncRetryDelaysMs[syncRetryCountRef.current++];
    if (delay === undefined) return;
    syncRetryTimerRef.current = window.setTimeout(() => {
      syncRetryTimerRef.current = undefined;
      requestCloudSync();
    }, delay);
  }, [requestCloudSync]);

  const refresh = useCallback(async () => {
    await initializeFoods();
    const [storedProfile, storedFoods, storedMeals] = await Promise.all([getSetting<Profile>("profile"), getAll<Food>("foods"), getAll<Meal>("meals")]);
    setProfile(storedProfile ? normalizeNutritionTargets(storedProfile) : DEFAULT_PROFILE); setFoods(storedFoods); setMeals(storedMeals); setStartupError(""); setReady(true);
  }, []);
  useEffect(() => {
    // IndexedDB is our external store; hydrate it once when the client mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh().catch(() => setStartupError("Your private diary could not be opened. Your data has not been reset."));
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const params = new URLSearchParams(window.location.search);
    if (params.has("scan")) { setInitialAddView("scan"); setAdding(true); }
    else if (params.has("add")) setAdding(true);
  }, [refresh, setAdding, setInitialAddView]);
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
    void checkForDeploymentUpdate();
    const interval = window.setInterval(() => void checkForDeploymentUpdate(), 60_000);
    document.addEventListener("visibilitychange", checkForDeploymentUpdate);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", checkForDeploymentUpdate);
    };
  }, []);
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
  }, [ready, setShowHomeScreenPrompt]);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    const retry = () => retryCloudSync();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [retryCloudSync]);
  useEffect(() => () => {
    if (syncRetryTimerRef.current !== undefined) window.clearTimeout(syncRetryTimerRef.current);
  }, []);
  useEffect(() => {
    if (!ready || !auth.ready || !auth.user) return;
    const user = auth.user;
    const identity = `user:${user.id}`;
    if (syncIdentityRef.current === identity) return;
    syncIdentityRef.current = identity;
    let active = true;
    cloudSyncInFlightRef.current = true;
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
        next = mergeSnapshots(local, remote);
        next.profile = remote.profile || local.profile;
        const remoteMealIds = new Set(remote.meals.map((meal) => meal.id));
        const remoteFoodIds = new Set(remote.foods.map((food) => food.id));
        shouldPush = local.meals.some((meal) => !remoteMealIds.has(meal.id))
          || local.foods.some((food) => food.source !== "seed" && !remoteFoodIds.has(food.id))
          || (!remote.profile && Boolean(local.profile));
      } else if (owner === identity) {
        next = mergeSnapshots(remote, local);
        next.profile = local.profile || remote.profile;
        shouldPush = true;
      } else {
        next = mergeSnapshots(local, remote);
        shouldPush = true;
      }

      if (next.profile) next.profile = normalizeNutritionTargets(next.profile);

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
      const remoteDeletedIds = remoteDeletedMealIdsRef.current;
      if (remoteDeletedIds.size) {
        next.meals = next.meals.filter((meal) => !remoteDeletedIds.has(meal.id));
        shouldPush = true;
      }
      if (shouldPush) {
        if (mutationAtStart !== syncMutationRef.current) return;
        const mutationAtPush = syncMutationRef.current;
        // Our own snapshot upserts emit Realtime events for every changed row.
        // Ignore that burst so it cannot recursively restart this sync forever.
        suppressRealtimeSyncUntilRef.current = Date.now() + 2_000;
        await pushCloudSnapshot(userId, next);
        if (mutationAtPush === syncMutationRef.current) await setSetting(`cloudDirty:${userId}`, false);
      }
      if (mutationAtStart !== syncMutationRef.current) return;
      await replaceLocalSnapshot(next);
      remoteDeletedMealIdsRef.current.clear();
      await setSetting("dataOwner", identity);
      if (active) { cloudWriteFailedRef.current = false; syncRetryCountRef.current = 0; await refresh(); setSyncState("synced"); }
    };
    synchronize().catch(() => {
      if (active) {
        setSyncState(navigator.onLine ? "error" : "offline");
        scheduleCloudRetry();
      }
    }).finally(() => {
      cloudSyncInFlightRef.current = false;
      if (cloudSyncQueuedRef.current) {
        cloudSyncQueuedRef.current = false;
        requestCloudSync();
      }
    });
    return () => { active = false; };
  }, [auth.configured, auth.ready, auth.user, ready, refresh, requestCloudSync, scheduleCloudRetry, syncAttempt]);

  useEffect(() => {
    if (!ready || !auth.ready || !auth.user || !auth.configured) return;
    const userId = auth.user.id;
    const supabase = getSupabase();
    if (!supabase) return;

    let syncTimer: number | undefined;
    const scheduleSync = (mealId?: string, event?: string) => {
      if (cloudWriteInFlightRef.current || Date.now() < suppressRealtimeSyncUntilRef.current) return;
      if (event === "DELETE" && mealId) remoteDeletedMealIdsRef.current.add(mealId);
      if (syncTimer !== undefined) window.clearTimeout(syncTimer);
      syncTimer = window.setTimeout(() => {
        syncTimer = undefined;
        requestCloudSync();
      }, 250);
    };
    const channel = supabase
      .channel(`diary-sync:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_meals", filter: `user_id=eq.${userId}` }, (payload) => {
        const row = payload.eventType === "DELETE" ? payload.old : payload.new;
        scheduleSync(typeof row?.id === "string" ? row.id : undefined, payload.eventType);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_foods", filter: `user_id=eq.${userId}` }, () => scheduleSync())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_profiles", filter: `user_id=eq.${userId}` }, () => scheduleSync())
      .subscribe();

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") scheduleSync();
    };
    const poll = window.setInterval(refreshWhenVisible, 30_000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      if (syncTimer !== undefined) window.clearTimeout(syncTimer);
      window.clearInterval(poll);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      void supabase.removeChannel(channel);
    };
  }, [auth.configured, auth.ready, auth.user, ready, requestCloudSync]);

  const syncWrite = (work: (userId: string) => Promise<void>) => {
    if (!auth.user) return;
    const userId = auth.user.id;
    const mutation = ++syncMutationRef.current;
    setSyncState("syncing");
    void setSetting(`cloudDirty:${userId}`, true)
      .then(() => {
        cloudWriteQueueRef.current = cloudWriteQueueRef.current.catch(() => undefined).then(async () => {
          cloudWriteInFlightRef.current = true;
          suppressRealtimeSyncUntilRef.current = Date.now() + 2_000;
          try {
            await work(userId);
          } finally {
            cloudWriteInFlightRef.current = false;
          }
        });
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
        scheduleCloudRetry();
      });
  };
  const saveProfile = async (next: Profile, announce = true) => {
    const synchronized = syncAutomaticFasting(normalizeCalorieTarget(normalizeNutritionTargets(next)), meals);
    // Reserve the local snapshot before IndexedDB writes. A cloud hydration
    // already in flight must not replace this profile (or its related diary
    // update) before its own cloud write has been queued.
    syncMutationRef.current += 1;
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
  const markSyncMutation = () => { syncMutationRef.current += 1; };
  return { ready, startupError, setStartupError, profile, setProfile, onboardingOrigin, setOnboardingOrigin, foods, setFoods, meals, setMeals, syncState, theme, setTheme, chatTextSize, setChatTextSize, refresh, syncWrite, saveProfile, markSyncMutation, retryCloudSync };
}
