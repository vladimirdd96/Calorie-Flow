"use client";

import { useMemo, useState } from "react";
import { PlanDateGrid } from "./PlanCalendarSheet";
import type { MealPlanEntry, MealType } from "@/lib/types";

const mealTypeOptions: { type: MealType; label: string }[] = [
  { type: "breakfast", label: "Breakfast" }, { type: "lunch", label: "Lunch" }, { type: "dinner", label: "Dinner" }, { type: "snack", label: "Snack" },
];

export function QuickPlanSheet({ entries, initialDate, itemName, onConfirm }: { entries: MealPlanEntry[]; initialDate: string; itemName: string; onConfirm: (date: string, mealType: MealType) => void }) {
  const [date, setDate] = useState(initialDate);
  const [mealType, setMealType] = useState<MealType>("dinner");
  const plannedDates = useMemo(() => new Set(entries.map((entry) => entry.date)), [entries]);

  return <div className="quick-plan-sheet">
    <div className="sheet-header"><div><span className="eyebrow">Add to plan</span><h2>Plan {itemName}</h2></div><span /></div>
    <PlanDateGrid selectedKey={date} plannedDates={plannedDates} onSelect={setDate} />
    <div className="quick-plan-meal-row" role="radiogroup" aria-label="Meal">
      {mealTypeOptions.map((option) => <button key={option.type} type="button" role="radio" aria-checked={mealType === option.type} className={mealType === option.type ? "active" : ""} onClick={() => setMealType(option.type)}>{option.label}</button>)}
    </div>
    <button type="button" className="primary-button full" onClick={() => onConfirm(date, mealType)}>Add to plan</button>
  </div>;
}
