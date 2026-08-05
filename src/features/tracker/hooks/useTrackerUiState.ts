"use client";

import { type Dispatch, type SetStateAction, useCallback, useEffect, useState } from "react";
import { localDateKey } from "@/lib/nutrition";
import type { AddFoodView } from "@/features/food-capture/types";
import type { AppNavigationTarget, AppTab } from "@/features/navigation/types";
import type { Food, Meal, MealType, Recipe } from "@/lib/types";

export type MealTimingPrompt = { meal: Meal; previousMeal: Meal; onDecision: (decision: "new" | "previous") => void };
export type PlanAddDraft = { date: string; mealType: MealType };

/** Ephemeral navigation and overlay state; no persistence or domain writes. */
export function useTrackerUiState() {
  const [navigationTarget, setNavigationTarget] = useState<AppNavigationTarget>({ tab: "today" });
  const tab = navigationTarget.tab;
  const setTab = useCallback<Dispatch<SetStateAction<AppTab>>>((nextTab) => {
    setNavigationTarget((current) => ({ tab: typeof nextTab === "function" ? nextTab(current.tab) : nextTab }));
  }, []);
  const navigateTo = useCallback((target: AppNavigationTarget) => {
    setNavigationTarget(target);
  }, []);
  const [dateKey, setDateKey] = useState(localDateKey());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [initialAddView, setInitialAddView] = useState<AddFoodView>("start");
  const [directFood, setDirectFood] = useState<Food>();
  const [foodDetails, setFoodDetails] = useState<Food>();
  const [editingFood, setEditingFood] = useState<Food>();
  const [editingMeal, setEditingMeal] = useState<Meal>();
  const [editingRecipeMeal, setEditingRecipeMeal] = useState<Meal>();
  const [detailMeal, setDetailMeal] = useState<Meal>();
  const [duplicateMealDraft, setDuplicateMealDraft] = useState<Meal>();
  const [moveMealDraft, setMoveMealDraft] = useState<Meal>();
  const [initialMealType, setInitialMealType] = useState<MealType>();
  const [toast, setToast] = useState("");
  const [showHomeScreenPrompt, setShowHomeScreenPrompt] = useState(false);
  const [weightPromptDismissedFor, setWeightPromptDismissedFor] = useState<string | null>(null);
  const [undoMeal, setUndoMeal] = useState<{ meal: Meal; timerId: number }>();
  const [imageMeal, setImageMeal] = useState<Meal>();
  const [nutritionDetailsOpen, setNutritionDetailsOpen] = useState(false);
  const [recipeToLog, setRecipeToLog] = useState<Recipe>();
  const [mealTimingPrompt, setMealTimingPrompt] = useState<MealTimingPrompt>();
  const [planAddDraft, setPlanAddDraft] = useState<PlanAddDraft>();

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return {
    tab, setTab, navigationTarget, navigateTo, dateKey, setDateKey, calendarOpen, setCalendarOpen,
    adding, setAdding, initialAddView, setInitialAddView, directFood, setDirectFood,
    foodDetails, setFoodDetails, editingFood, setEditingFood,
    editingMeal, setEditingMeal, editingRecipeMeal, setEditingRecipeMeal, detailMeal, setDetailMeal, duplicateMealDraft, setDuplicateMealDraft,
    moveMealDraft, setMoveMealDraft, initialMealType, setInitialMealType, toast, setToast,
    showHomeScreenPrompt, setShowHomeScreenPrompt, weightPromptDismissedFor, setWeightPromptDismissedFor,
    undoMeal, setUndoMeal, imageMeal, setImageMeal, nutritionDetailsOpen, setNutritionDetailsOpen,
    recipeToLog, setRecipeToLog,
    mealTimingPrompt, setMealTimingPrompt,
    planAddDraft, setPlanAddDraft,
  };
}
