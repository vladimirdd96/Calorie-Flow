"use client";

import { ChevronDown, ChevronLeft, ChevronRight, MessageCircle, ShieldCheck } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { Sheet } from "@/features/shared/Sheet";
import { localDateKey, netCarbs, resolveDailyTargets, resolveMealCalorieTarget, round, sumNutrition } from "@/lib/nutrition";
import type { Meal, MealType, Nutrition, Profile, Recipe } from "@/lib/types";
import { BrandMark, changeDate, dayLabel, mealLabels, MiniProgressRing, ProgressRing } from "./components/DiaryPrimitives";
import { DailyRhythm, HomeScreenPrompt, MealAddRow, SaveRecipeSheet } from "./components/DiaryTools";
import { MealRow } from "./components/MealControls";

export { DuplicateMealSheet, MealEditor, MoveMealSheet } from "./components/MealControls";
export { RecipeLogSheet } from "./components/DiaryTools";
export { readMealImage } from "./components/DiaryPrimitives";

export function TodayView({
  profile,
  meals,
  dateKey,
  onDateChange,
  onAdd,
  onOpenCoach,
  onDelete,
  onEdit,
  onOpenDetails,
  onOpenNutritionDetails,
  onOpenImage,
  onDropMeal,
  onDuplicate,
  onMove,
  syncLabel,
  showHomeScreenPrompt,
  onDismissHomeScreenPrompt,
  onOpenCalendar,
  onSaveProfile,
  onSaveRecipe,
}: {
  profile: Profile;
  meals: Meal[];
  dateKey: string;
  onDateChange: (date: string) => void;
  onAdd: (mealType?: MealType) => void;
  onOpenCoach: () => void;
  onDelete: (id: string) => void;
  onEdit: (meal: Meal) => void;
  onOpenDetails: (meal: Meal) => void;
  onOpenNutritionDetails: () => void;
  onOpenImage: (meal: Meal) => void;
  onDropMeal: (meal: Meal, mealType: MealType, targetMealId?: string, insertAfter?: boolean) => void;
  onDuplicate: (meal: Meal) => void;
  onMove: (meal: Meal) => void;
  syncLabel: string;
  showHomeScreenPrompt: boolean;
  onDismissHomeScreenPrompt: () => void;
  onOpenCalendar: () => void;
  onSaveProfile: (profile: Profile) => void;
  onSaveRecipe: (recipe: Recipe, components: Meal[]) => Promise<void>;
}) {
  const [recipeDraftMeals, setRecipeDraftMeals] = useState<Meal[]>();
  const [dropTarget, setDropTarget] = useState<string>();
  const [draggingMealId, setDraggingMealId] = useState<string>();
  const pointerDragRef = useRef<{ meal: Meal; pointerId: number; startX: number; startY: number; active: boolean; timerId?: number } | undefined>(undefined);
  const total = useMemo(() => sumNutrition(meals.map((meal) => meal.nutrition)), [meals]);
  const targets = resolveDailyTargets(profile, dateKey);
  const carbs = profile.carbDisplay === "net" ? netCarbs(total) : total.carbs;
  const remaining = Math.max(0, targets.calories - total.calories);
  const grouped = (Object.keys(mealLabels) as MealType[]).map((type) => ({ type, meals: meals.filter((meal) => meal.mealType === type) }));
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
      <header className="topbar">
        <div className="brand"><BrandMark /><div><strong>Calorie Flow</strong><small>Simple by default</small></div></div>
        <div className="status-pill"><ShieldCheck size={14} /> {syncLabel}</div>
      </header>

      <div className="date-switcher">
        <button className="icon-button ghost" onClick={() => onDateChange(changeDate(dateKey, -1))} aria-label="Previous day"><ChevronLeft /></button>
        <button className="date-switcher-current" onClick={onOpenCalendar} aria-label={`Open calendar for ${dayLabel(dateKey)}`}><strong>{dayLabel(dateKey)}</strong><span>{new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric" })}</span><ChevronDown size={15} aria-hidden="true" /></button>
        <button className="icon-button ghost" disabled={dateKey >= localDateKey()} onClick={() => onDateChange(changeDate(dateKey, 1))} aria-label="Next day"><ChevronRight /></button>
      </div>

      {showHomeScreenPrompt && <HomeScreenPrompt onDismiss={onDismissHomeScreenPrompt} />}

      <section className="hero-grid">
        <div className="hero-card card">
          {profile.hideCalories ? <div className="nutrition-focus"><span className="eyebrow">Today’s nutrients</span><strong>Focus on your macros</strong><p>Protein, carbs, fat and fibre stay visible. Energy numbers are hidden.</p></div> : <ProgressRing value={total.calories} target={targets.calories} nutrition={total} />}
          <div className="hero-stat-grid">
            {!profile.hideCalories && <div><span>Remaining</span><strong>{Math.round(remaining).toLocaleString()}</strong><small>kcal</small></div>}
            <div><span>Fibre</span><strong>{round(total.fiber, 0)}</strong><small>/ {targets.fiber} g</small></div>
          </div>
        </div>
        <div className="macro-card card">
          <div className="section-heading compact"><div><span className="eyebrow">Daily nutrition</span><h2>Macro totals</h2></div><span className="subtle">from food & drinks</span></div>
          <div className="macro-total-grid"><div><span>Protein</span><strong>{round(total.protein)}<small>g</small></strong></div><div><span>{profile.carbDisplay === "net" ? "Net carbs" : "Carbs"}</span><strong>{round(carbs)}<small>g</small></strong></div><div><span>Fat</span><strong>{round(total.fat)}<small>g</small></strong></div></div>
          <button type="button" className="macro-expand-trigger" onClick={onOpenNutritionDetails}><span>See full nutrition details</span><span className="macro-expand-hint"><span>View details</span><ChevronDown size={17} aria-hidden="true" /></span></button>
        </div>
      </section>

      <section className="log-section">
        <div className="section-heading"><div><span className="eyebrow">Daily log</span><h2>Your meals</h2></div><span className="subtle meal-reorder-hint">Hold ⋮⋮ to reorder</span></div>
        {grouped.map(({ type, meals: groupMeals }) => (
          <div className="meal-group" key={type}>
            <div className="meal-group-title"><span>{mealLabels[type]}</span>{!profile.hideCalories && (() => { const target = resolveMealCalorieTarget(profile, type); const calories = Math.round(sumNutrition(groupMeals.map((meal) => meal.nutrition)).calories); return <span aria-label={target ? `${calories} of ${target} calorie guide` : `${calories} calories`}>{calories}{target ? ` / ${target}` : ""} kcal</span>; })()}</div>
            <div className={`meal-list card ${dropTarget === type ? "drop-target" : ""}`} data-meal-list={type} onDragOver={(event) => { event.preventDefault(); setDropTarget(type); }} onDragLeave={() => setDropTarget(undefined)} onDrop={(event) => { event.preventDefault(); const mealId = event.dataTransfer.getData("text/meal-id"); const meal = meals.find((candidate) => candidate.id === mealId); if (meal) onDropMeal(meal, type); setDropTarget(undefined); }}>
              {groupMeals.map((meal) => <MealRow key={meal.id} meal={meal} hideCalories={profile.hideCalories} dragging={draggingMealId === meal.id} onPointerDown={startPointerDrag} onOpenImage={() => onOpenImage(meal)} dropPosition={dropTarget === `${type}:${meal.id}:before` ? "before" : dropTarget === `${type}:${meal.id}:after` ? "after" : undefined} onDelete={() => onDelete(meal.id)} onEdit={() => onEdit(meal)} onDetails={() => meal.recipeId ? onEdit(meal) : onOpenDetails(meal)} onDuplicate={() => onDuplicate(meal)} onMove={() => onMove(meal)} onDragStart={(draggedMeal, event) => { event.dataTransfer.setData("text/meal-id", draggedMeal.id); event.dataTransfer.effectAllowed = "move"; }} onDragOver={(event) => { event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); setDropTarget(`${type}:${meal.id}:${event.clientY < rect.top + rect.height / 2 ? "before" : "after"}`); }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const mealId = event.dataTransfer.getData("text/meal-id"); const draggedMeal = meals.find((candidate) => candidate.id === mealId); if (draggedMeal) { const rect = event.currentTarget.getBoundingClientRect(); onDropMeal(draggedMeal, type, meal.id, event.clientY >= rect.top + rect.height / 2); } setDropTarget(undefined); }} />)}
              <MealAddRow mealType={type} meals={groupMeals} onAdd={onAdd} onSaveRecipe={setRecipeDraftMeals} />
            </div>
          </div>
        ))}
        <DailyRhythm profile={profile} dateKey={dateKey} onSave={onSaveProfile} />
      </section>

      <button className="coach-check-in" onClick={onOpenCoach}>
        <span className="action-icon mint"><MessageCircle size={19} /></span>
        <span><strong>Ask Coach about today</strong><small>Get guidance with your diary in context</small></span>
        <ChevronRight size={18} />
      </button>
      {recipeDraftMeals && <Sheet onClose={() => setRecipeDraftMeals(undefined)} label="Save meal as recipe"><SaveRecipeSheet meals={recipeDraftMeals} onSave={async (recipe, components) => { await onSaveRecipe(recipe, components); setRecipeDraftMeals(undefined); }} onClose={() => setRecipeDraftMeals(undefined)} /></Sheet>}
    </main>
  );
}

export function CalendarSheet({ dateKey, meals, profile, onDateChange, onClose }: { dateKey: string; meals: Meal[]; profile: Profile; onDateChange: (date: string) => void; onClose: () => void }) {
  const selectedDate = new Date(`${dateKey}T12:00:00`);
  const [monthStart, setMonthStart] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 12));
  const today = localDateKey();
  const monthTitle = monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const firstWeekday = (monthStart.getDay() + 6) % 7;
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const calendarDays = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - firstWeekday + 1;
    if (day < 1 || day > daysInMonth) return undefined;
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day, 12);
    return localDateKey(date);
  });
  const totalsByDate = useMemo(() => {
    const totals = new Map<string, Nutrition>();
    meals.forEach((meal) => {
      const key = meal.loggedDate || localDateKey(new Date(meal.createdAt));
      const previous = totals.get(key);
      totals.set(key, previous ? sumNutrition([previous, meal.nutrition]) : meal.nutrition);
    });
    return totals;
  }, [meals]);
  const previousMonth = () => setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1, 12));
  const nextMonth = () => {
    const next = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1, 12);
    if (localDateKey(next) <= today) setMonthStart(next);
  };
  const chooseDate = (key: string) => { onDateChange(key); onClose(); };

  return <div className="calendar-sheet">
    <div className="sheet-header"><div><span className="eyebrow">Your diary</span><h2>Month at a glance</h2></div><span /></div>
    <p className="calendar-intro">Tap a day to jump to its log. Rings show how close you were to your daily guide.</p>
    <div className="calendar-toolbar"><button className="icon-button ghost" onClick={previousMonth} aria-label="Previous month"><ChevronLeft /></button><strong>{monthTitle}</strong><button className="icon-button ghost" onClick={nextMonth} disabled={monthStart.getFullYear() === new Date(`${today}T12:00:00`).getFullYear() && monthStart.getMonth() >= new Date(`${today}T12:00:00`).getMonth()} aria-label="Next month"><ChevronRight /></button></div>
    <div className="calendar-weekdays" aria-hidden="true">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div>
    <div className="calendar-grid" role="grid" aria-label={monthTitle}>
      {calendarDays.map((key, index) => key ? (() => {
        const total = totalsByDate.get(key);
        const isFuture = key > today;
        const isSelected = key === dateKey;
        const progressValue = profile.hideCalories ? total?.protein || 0 : total?.calories || 0;
        const targets = resolveDailyTargets(profile, key);
        const progressTarget = profile.hideCalories ? targets.protein : targets.calories;
        return <button key={key} className={`calendar-day ${isSelected ? "selected" : ""} ${total ? "logged" : ""}`} role="gridcell" onClick={() => chooseDate(key)} disabled={isFuture} aria-label={`${new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric" })}${total ? `, ${Math.round(progressValue)} of ${progressTarget} ${profile.hideCalories ? "grams protein" : "calories"}` : ", no meals logged"}`}>
          <span>{new Date(`${key}T12:00:00`).getDate()}</span>{total && <MiniProgressRing value={progressValue} target={progressTarget} label="" />}
        </button>;
      })() : <span className="calendar-day empty" key={`empty-${index}`} aria-hidden="true" />)}
    </div>
    <div className="calendar-legend"><span><i className="legend-ring" /> Logged day</span><span><i className="legend-selected" /> Selected</span>{!profile.hideCalories && <small>Uses each day’s target</small>}</div>
  </div>;
}
