"use client";

import { useMemo } from "react";
import { localDateKey } from "@/lib/nutrition";
import type { Food, MealPlanEntry, Recipe } from "@/lib/types";

function startOfWeek(dateKey: string) {
  const day = new Date(`${dateKey}T12:00:00`);
  const weekday = day.getDay();
  day.setDate(day.getDate() + ((weekday === 0 ? -6 : 1) - weekday));
  return day;
}

export function WeekStrip({ date, entries, recipes, foods, onSelect }: {
  date: string;
  entries: MealPlanEntry[];
  recipes: Recipe[];
  foods: Food[];
  onSelect: (date: string) => void;
}) {
  const days = useMemo(() => {
    const start = startOfWeek(date);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start);
      day.setDate(day.getDate() + index);
      return localDateKey(day);
    });
  }, [date]);
  const today = localDateKey();

  return <div className="week-strip" role="tablist" aria-label="Week overview">
    {days.map((dayKey) => {
      const dayEntries = entries.filter((entry) => entry.date === dayKey);
      const calories = dayEntries.reduce((total, entry) => {
        const recipe = entry.recipeId ? recipes.find((item) => item.id === entry.recipeId) : undefined;
        const food = entry.foodId ? foods.find((item) => item.id === entry.foodId) : undefined;
        return total + (recipe?.nutritionPerServing.calories || food?.nutrientsPer100.calories || 0);
      }, 0);
      const dayDate = new Date(`${dayKey}T12:00:00`);
      const className = ["week-strip-day", dayKey === date && "active", dayKey === today && "today"].filter(Boolean).join(" ");
      return <button key={dayKey} type="button" role="tab" aria-selected={dayKey === date} className={className} onClick={() => onSelect(dayKey)}>
        <small>{dayDate.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2)}</small>
        <strong>{dayDate.getDate()}</strong>
        {dayEntries.length ? <span className="week-strip-total">{Math.round(calories)}</span> : <span className="week-strip-dot" aria-hidden="true" />}
      </button>;
    })}
  </div>;
}
