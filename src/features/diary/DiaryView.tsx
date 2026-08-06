"use client";

import { CalendarDays, ChevronLeft, ChevronRight, MessageCircle, Plus, TrendingUp } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { Sheet } from "@/features/shared/Sheet";
import { CalendarPicker } from "@/features/shared/DatePicker";
import { isHabitFeatureEnabled } from "@/lib/habit-settings";
import { localDateKey, resolveDailyTargets, resolveMealCalorieTarget, sumNutrition } from "@/lib/nutrition";
import { habitFeatures, type Food, type Meal, type MealType, type Nutrition, type Profile, type Recipe } from "@/lib/types";
import { BrandMark, changeDate, dayLabel, mealLabels, MiniProgressRing } from "./components/DiaryPrimitives";
import { HomeScreenPrompt, SaveRecipeSheet } from "./components/DiaryTools";
import { MealRow } from "./components/MealControls";
import { TodaySummary, TodayWater } from "./components/TodaySummary";
import type { InsightsSection } from "@/features/navigation/types";

export { DuplicateMealSheet, MealEditor, MoveMealSheet } from "./components/MealControls";
export { RecipeLogSheet } from "./components/DiaryTools";
export { readMealImage } from "./components/DiaryPrimitives";

export function TodayView({
  profile,
  foods,
  recipes,
  meals,
  dateKey,
  onDateChange,
  onAdd,
  onOpenCoach,
  onDelete,
  onEdit,
  onOpenDetails,
  onOpenImage,
  onDropMeal,
  onMove,
  showHomeScreenPrompt,
  onDismissHomeScreenPrompt,
  onOpenCalendar,
  onOpenInsights,
  onSaveProfile,
  onSaveRecipe,
  onOpenTargets,
}: {
  profile: Profile;
  foods: Food[];
  recipes: Recipe[];
  meals: Meal[];
  dateKey: string;
  onDateChange: (date: string) => void;
  onAdd: (mealType?: MealType) => void;
  onOpenCoach: () => void;
  onDelete: (id: string) => void;
  onEdit: (meal: Meal) => void;
  onOpenDetails: (meal: Meal) => void;
  onOpenImage: (meal: Meal) => void;
  onDropMeal: (meal: Meal, mealType: MealType, targetMealId?: string, insertAfter?: boolean) => void;
  onMove: (meal: Meal) => void;
  showHomeScreenPrompt: boolean;
  onDismissHomeScreenPrompt: () => void;
  onOpenCalendar: () => void;
  onOpenInsights: (section?: InsightsSection) => void;
  onSaveProfile: (profile: Profile) => void;
  onSaveRecipe: (recipe: Recipe, components: Meal[]) => Promise<void>;
  onOpenTargets: () => void;
}) {
  const [recipeDraftMeals, setRecipeDraftMeals] = useState<Meal[]>();
  const [dropTarget, setDropTarget] = useState<string>();
  const [draggingMealId, setDraggingMealId] = useState<string>();
  const pointerDragRef = useRef<{ meal: Meal; pointerId: number; startX: number; startY: number; active: boolean; timerId?: number } | undefined>(undefined);
  const total = useMemo(() => sumNutrition(meals.map((meal) => meal.nutrition)), [meals]);
  const targets = resolveDailyTargets(profile, dateKey);
  const grouped = (Object.keys(mealLabels) as MealType[]).map((type) => {
    const typeMeals = meals.filter((meal) => meal.mealType === type);
    return { type, meals: typeMeals };
  });
  const updatePointerDropTarget = useCallback((clientX: number, clientY: number) => {
    const hovered = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-meal-id], [data-meal-list]");
    if (!hovered) { setDropTarget(undefined); return; }
    const mealId = hovered.dataset.mealId;
    const mealType = hovered.dataset.mealType || hovered.dataset.mealList;
    if (!mealType) { setDropTarget(undefined); return; }
    if (!mealId) { setDropTarget(mealType); return; }
    const rect = hovered.getBoundingClientRect();
    setDropTarget(`${mealType}:${mealId}:${clientY < rect.top + rect.height / 2 ? "before" : "after"}`);
  }, []);
  const finishPointerDrag = useCallback((clientX: number, clientY: number) => {
    const drag = pointerDragRef.current;
    if (!drag) return;
    if (drag.timerId) window.clearTimeout(drag.timerId);
    pointerDragRef.current = undefined;
    setDraggingMealId(undefined);
    setDropTarget(undefined);
    if (!drag.active) return;
    const hovered = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-meal-id], [data-meal-list]");
    const mealType = hovered?.dataset.mealType || hovered?.dataset.mealList;
    if (!mealType) return;
    const targetMealId = hovered?.dataset.mealId;
    const rect = hovered?.getBoundingClientRect();
    onDropMeal(drag.meal, mealType as MealType, targetMealId, Boolean(targetMealId && rect && clientY >= rect.top + rect.height / 2));
  }, [onDropMeal]);
  const cancelPointerDrag = useCallback(() => {
    const drag = pointerDragRef.current;
    if (drag?.timerId) window.clearTimeout(drag.timerId);
    pointerDragRef.current = undefined;
    setDraggingMealId(undefined);
    setDropTarget(undefined);
  }, []);
  const startPointerDrag = useCallback((meal: Meal, event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse") return;
    event.preventDefault();
    cancelPointerDrag();
    const drag: { meal: Meal; pointerId: number; startX: number; startY: number; active: boolean; timerId?: number } = { meal, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, active: false };
    drag.timerId = window.setTimeout(() => {
      if (pointerDragRef.current?.pointerId !== drag.pointerId) return;
      drag.active = true;
      setDraggingMealId(meal.id);
      updatePointerDropTarget(drag.startX, drag.startY);
    }, 220);
    pointerDragRef.current = drag;
    const move = (moveEvent: PointerEvent) => {
      const current = pointerDragRef.current;
      if (!current || current.pointerId !== moveEvent.pointerId) return;
      if (!current.active) {
        const distance = Math.hypot(moveEvent.clientX - current.startX, moveEvent.clientY - current.startY);
        if (distance > 10) cancelPointerDrag();
        return;
      }
      moveEvent.preventDefault();
      updatePointerDropTarget(moveEvent.clientX, moveEvent.clientY);
    };
    const end = (endEvent: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", cancel);
      finishPointerDrag(endEvent.clientX, endEvent.clientY);
    };
    const cancel = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", cancel);
      cancelPointerDrag();
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", cancel);
  }, [cancelPointerDrag, finishPointerDrag, updatePointerDropTarget]);
  return (
    <main className="page today-page">
      <header className="today-header">
        <div className="today-brand"><BrandMark /><div><span>{new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening"}</span><strong>Calorie Flow</strong></div></div>
        <div className="today-header-actions"><button type="button" className="today-coach-button" onClick={onOpenCoach} aria-label="Ask Coach"><MessageCircle /></button></div>
      </header>

      {showHomeScreenPrompt && <HomeScreenPrompt onDismiss={onDismissHomeScreenPrompt} />}

      <TodaySummary profile={profile} meals={meals} total={total} targets={targets} onSaveProfile={onSaveProfile} onOpenWeight={() => onOpenInsights("weight")} onOpenFasting={() => onOpenInsights("fasting")} onOpenTargets={onOpenTargets} dateNav={<div className="today-date-control"><button type="button" onClick={() => onDateChange(changeDate(dateKey, -1))} aria-label="Previous day"><ChevronLeft /></button><button type="button" className="today-date-label" onClick={onOpenCalendar} aria-label={`Open calendar for ${dayLabel(dateKey)}`}><CalendarDays /><span>{dayLabel(dateKey)}</span></button><button type="button" disabled={dateKey >= localDateKey()} onClick={() => onDateChange(changeDate(dateKey, 1))} aria-label="Next day"><ChevronRight /></button></div>} />
      {isHabitFeatureEnabled(profile.enabledHabitFeatures, habitFeatures.water) && <TodayWater profile={profile} dateKey={dateKey} onSave={onSaveProfile} />}

      <section className="log-section">
        {grouped.map(({ type, meals: groupMeals }) => (
          <div className="meal-group" key={type}>
            <div className="meal-group-title"><span>{mealLabels[type]}</span><span>{!profile.hideCalories && (() => { const target = resolveMealCalorieTarget(profile, type); const calories = Math.round(sumNutrition(groupMeals.map((meal) => meal.nutrition)).calories); return <em className={target && calories > target ? "over" : ""} aria-label={target ? `${calories} of ${target} calorie guide` : `${calories} calories`}>{groupMeals.length ? `${calories}${target ? ` / ${target}` : ""} kcal` : ""}</em>; })()}{groupMeals.length > 0 && <button type="button" onClick={() => onAdd(type)} aria-label={`Add food to ${mealLabels[type]}`}><Plus /></button>}</span></div>
            {groupMeals.length ? <div className={`meal-list card ${dropTarget === type ? "drop-target" : ""}`} data-meal-list={type} onDragOver={(event) => { event.preventDefault(); setDropTarget(type); }} onDragLeave={() => setDropTarget(undefined)} onDrop={(event) => { event.preventDefault(); const mealId = event.dataTransfer.getData("text/meal-id"); const meal = meals.find((candidate) => candidate.id === mealId); if (meal) onDropMeal(meal, type); setDropTarget(undefined); }}>
              {groupMeals.map((meal) => { const linkedImageUrl = meal.imageUrl || (meal.recipeId ? recipes.find((recipe) => recipe.id === meal.recipeId)?.imageUrls?.[0] : foods.find((food) => food.id === meal.foodId)?.imageUrl); return <MealRow key={meal.id} meal={meal} imageUrl={linkedImageUrl} hideCalories={profile.hideCalories} showEstimatedBadge={profile.showEstimatedBadges !== false} dragging={draggingMealId === meal.id} onPointerDown={startPointerDrag} onOpenImage={() => onOpenImage({ ...meal, imageUrl: linkedImageUrl })} dropPosition={dropTarget === `${type}:${meal.id}:before` ? "before" : dropTarget === `${type}:${meal.id}:after` ? "after" : undefined} onDelete={() => onDelete(meal.id)} onEdit={() => onEdit(meal)} onDetails={() => meal.recipeId ? onEdit(meal) : onOpenDetails(meal)} onMove={() => onMove(meal)} onDragStart={(draggedMeal, event) => { event.dataTransfer.setData("text/meal-id", draggedMeal.id); event.dataTransfer.effectAllowed = "move"; }} onDragOver={(event) => { event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); setDropTarget(`${type}:${meal.id}:${event.clientY < rect.top + rect.height / 2 ? "before" : "after"}`); }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const mealId = event.dataTransfer.getData("text/meal-id"); const draggedMeal = meals.find((candidate) => candidate.id === mealId); if (draggedMeal) { const rect = event.currentTarget.getBoundingClientRect(); onDropMeal(draggedMeal, type, meal.id, event.clientY >= rect.top + rect.height / 2); } setDropTarget(undefined); }} />; })}
              {groupMeals.filter((meal) => !meal.recipeId).length > 1 && <button type="button" className="combine-recipe" onClick={() => setRecipeDraftMeals(groupMeals.filter((meal) => !meal.recipeId))}>Combine into recipe</button>}
            </div> : <button type="button" className="empty-meal-button" onClick={() => onAdd(type)} data-meal-list={type}><Plus />Add {mealLabels[type].toLowerCase()}</button>}
          </div>
        ))}
      </section>

      <button type="button" className="coach-check-in today-insights-teaser" onClick={() => onOpenInsights("overview")}>
        <span className="action-icon mint"><TrendingUp size={19} /></span>
        <span><strong>{profile.hideCalories ? "See your nutrition patterns" : "Review your weekly calorie trend"}</strong><small>Protein target and daily averages</small></span>
        <ChevronRight size={18} />
      </button>
      {recipeDraftMeals && <Sheet onClose={() => setRecipeDraftMeals(undefined)} label="Save meal as recipe"><SaveRecipeSheet meals={recipeDraftMeals} onSave={async (recipe, components) => { await onSaveRecipe(recipe, components); setRecipeDraftMeals(undefined); }} onClose={() => setRecipeDraftMeals(undefined)} /></Sheet>}
    </main>
  );
}

export function CalendarSheet({ dateKey, meals, profile, onDateChange, onClose }: { dateKey: string; meals: Meal[]; profile: Profile; onDateChange: (date: string) => void; onClose: () => void }) {
  const [selectedDate, setSelectedDate] = useState(dateKey);
  const totalsByDate = useMemo(() => {
    const totals = new Map<string, Nutrition>();
    meals.forEach((meal) => {
      const key = meal.loggedDate || localDateKey(new Date(meal.createdAt));
      const previous = totals.get(key);
      totals.set(key, previous ? sumNutrition([previous, meal.nutrition]) : meal.nutrition);
    });
    return totals;
  }, [meals]);
  const selectedTotal = totalsByDate.get(selectedDate);
  const selectedTargets = resolveDailyTargets(profile, selectedDate);
  const selectedValue = profile.hideCalories ? selectedTotal?.protein || 0 : selectedTotal?.calories || 0;
  const selectedTarget = profile.hideCalories ? selectedTargets.protein : selectedTargets.calories;
  const percent = Math.min(100, Math.round(selectedValue / Math.max(1, selectedTarget) * 100));
  return <div className="calendar-sheet today-calendar-sheet">
    <CalendarPicker value={selectedDate} maxDate={localDateKey()} onChange={setSelectedDate} renderDay={(key) => { const total = totalsByDate.get(key); if (!total) return null; const targets = resolveDailyTargets(profile, key); return <MiniProgressRing value={profile.hideCalories ? total.protein : total.calories} target={profile.hideCalories ? targets.protein : targets.calories} label="" />; }} getDayLabel={(key) => { const total = totalsByDate.get(key); const targets = resolveDailyTargets(profile, key); const progressValue = profile.hideCalories ? total?.protein || 0 : total?.calories || 0; const progressTarget = profile.hideCalories ? targets.protein : targets.calories; return `${new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric" })}${total ? `, ${Math.round(progressValue)} of ${progressTarget} ${profile.hideCalories ? "grams protein" : "calories"}` : ", no meals logged"}`; }} />
    <div className="calendar-day-summary"><div className="calendar-summary-ring" style={{ "--progress": `${percent}%` } as React.CSSProperties}><strong>{percent}%</strong></div><div><small>{selectedDate === localDateKey() ? "Today" : new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</small><strong>{Math.round(selectedValue)} <em>{profile.hideCalories ? "g protein logged" : "kcal logged"}</em></strong><span>Target {selectedTarget} {profile.hideCalories ? "g" : "kcal"}</span></div></div>
    {!selectedTotal && <p className="calendar-missed">No meals logged this day</p>}
    {selectedDate !== dateKey && <button type="button" className="primary-button calendar-view-day" onClick={() => { onDateChange(selectedDate); onClose(); }}>View this day</button>}
  </div>;
}
