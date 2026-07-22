"use client";

import { useEffect, useState } from "react";
import { localDateKey } from "@/lib/nutrition";
import type { AddFoodView } from "@/features/food-capture/types";
import type { AppTab } from "@/features/navigation/types";
import type { Food, Meal, MealType, Recipe } from "@/lib/types";

/** Ephemeral navigation and overlay state; no persistence or domain writes. */
export function useTrackerUiState() {
  const [tab, setTab] = useState<AppTab>("today");
  const [dateKey, setDateKey] = useState(localDateKey());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [initialAddView, setInitialAddView] = useState<AddFoodView>("start");
  const [directFood, setDirectFood] = useState<Food>();
  const [editingMeal, setEditingMeal] = useState<Meal>();
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

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return {
    tab, setTab, dateKey, setDateKey, calendarOpen, setCalendarOpen,
    adding, setAdding, initialAddView, setInitialAddView, directFood, setDirectFood,
    editingMeal, setEditingMeal, detailMeal, setDetailMeal, duplicateMealDraft, setDuplicateMealDraft,
    moveMealDraft, setMoveMealDraft, initialMealType, setInitialMealType, toast, setToast,
    showHomeScreenPrompt, setShowHomeScreenPrompt, weightPromptDismissedFor, setWeightPromptDismissedFor,
    undoMeal, setUndoMeal, imageMeal, setImageMeal, nutritionDetailsOpen, setNutritionDetailsOpen,
    recipeToLog, setRecipeToLog,
  };
}
