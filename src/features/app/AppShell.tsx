"use client";
/* eslint-disable @next/next/no-img-element -- static brand asset is part of the shell. */

import { Check, Database } from "lucide-react";
import { useMemo } from "react";
import { AuthGateway } from "@/features/auth/AuthGateway";
import { useAppUiState } from "@/features/app/useAppUiState";
import { useDiaryActions } from "@/features/app/useDiaryActions";
import { useLocalFirstData } from "@/features/app/useLocalFirstData";
import { CoachView } from "@/features/coach/CoachView";
import { CalendarSheet, DuplicateMealSheet, MealEditor, MoveMealSheet, RecipeLogSheet, TodayView } from "@/features/diary/DiaryView";
import { DailyNutritionBreakdown, MealImageViewer, NutritionDetails } from "@/features/diary/NutritionDetails";
import { DiscoverView } from "@/features/food-catalogue/DiscoverView";
import { AddFoodSheet, PortionSheet } from "@/features/food-capture/FoodCapture";
import { InsightsView } from "@/features/insights/InsightsView";
import { BottomNav } from "@/features/navigation/BottomNav";
import { PlanView } from "@/features/planning/PlanView";
import { MeasurementPreferencePrompt, OnboardingDialog, ProfileView, WeightTrackingPrompt } from "@/features/profile/ProfileView";
import { Sheet } from "@/features/shared/Sheet";
import { useAuth } from "@/hooks/useAuth";
import { setSetting } from "@/lib/db";
import { localDateKey, sumNutrition } from "@/lib/nutrition";
import type { Meal } from "@/lib/types";
import { weightTrackingStatuses } from "@/lib/types";

type ThemeMode = "light" | "dark";
type ChatTextSize = "compact" | "comfortable" | "large";
type SyncState = "local" | "syncing" | "synced" | "offline" | "error";
const THEME_SETTING = "appearance:theme";
const CHAT_TEXT_SIZE_SETTING = "appearance:chat-text-size";
const compareMealOrder = (left: Meal, right: Meal) => (left.position ?? Number.MAX_SAFE_INTEGER) - (right.position ?? Number.MAX_SAFE_INTEGER) || left.createdAt.localeCompare(right.createdAt);

function BrandMark({ large = false }: { large?: boolean }) {
  return <img className={`brand-mark${large ? " large" : ""}`} src="/icon.svg" alt="" aria-hidden="true" />;
}

export function AppShell() {
  const auth = useAuth();
  const ui = useAppUiState();
  const { tab, setTab, dateKey, setDateKey, calendarOpen, setCalendarOpen, adding, setAdding, initialAddView, setInitialAddView, directFood, setDirectFood, editingMeal, setEditingMeal, detailMeal, setDetailMeal, duplicateMealDraft, setDuplicateMealDraft, moveMealDraft, setMoveMealDraft, initialMealType, setInitialMealType, toast, setToast, showHomeScreenPrompt, setShowHomeScreenPrompt, weightPromptDismissedFor, setWeightPromptDismissedFor, undoMeal, setUndoMeal, imageMeal, setImageMeal, nutritionDetailsOpen, setNutritionDetailsOpen, recipeToLog, setRecipeToLog } = ui;
  const local = useLocalFirstData(auth, { setAdding, setInitialAddView, setShowHomeScreenPrompt, setToast });
  const { ready, startupError, setStartupError, profile, onboardingOrigin, setOnboardingOrigin, foods, setFoods, meals, setMeals, syncState, theme, setTheme, chatTextSize, setChatTextSize, refresh, syncWrite, saveProfile, markSyncMutation } = local;
  const dayMeals = useMemo(() => meals.filter((meal) => (meal.loggedDate || localDateKey(new Date(meal.createdAt))) === dateKey).sort(compareMealOrder), [meals, dateKey]);
  const actions = useDiaryActions({ auth, profile, meals, dateKey, onboardingOrigin, undoMeal, setFoods, setMeals, setOnboardingOrigin, setUndoMeal, setAdding, setDirectFood, setInitialMealType, setInitialAddView, setDateKey, setToast, setTab, setEditingMeal, setDuplicateMealDraft, saveProfile, syncWrite, markSyncMutation, refresh });
  const { restartOnboarding, finishOnboarding, cancelOnboarding, logMeal, saveFood, saveEditedMeal, dropMeal, duplicateMeal, saveNewMeal, logCoachMeal, addPhotoMeal, deleteMeal, undoDeleteMeal, exportBackup, restoreBackup, openAdd, selectFood } = actions;
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
