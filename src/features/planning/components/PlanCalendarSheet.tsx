"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { localDateKey } from "@/lib/nutrition";
import type { MealPlanEntry } from "@/lib/types";

const weekdayLabels = ["M", "T", "W", "T", "F", "S", "S"];

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function PlanCalendarSheet({ dateKey, entries, onSelect }: { dateKey: string; entries: MealPlanEntry[]; onSelect: (dateKey: string) => void }) {
  const selectedDate = new Date(`${dateKey}T12:00:00`);
  const [month, setMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 12));
  const todayKey = localDateKey();
  const plannedDates = useMemo(() => new Set(entries.map((entry) => entry.date)), [entries]);
  const cells = useMemo(() => {
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1, 12);
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12).getDate();
    return Array.from({ length: 42 }, (_, index) => {
      const day = index - mondayOffset + 1;
      if (day < 1 || day > daysInMonth) return null;
      const date = new Date(month.getFullYear(), month.getMonth(), day, 12);
      const key = localDateKey(date);
      return { day, key, isPast: key < todayKey, hasPlan: plannedDates.has(key) };
    });
  }, [month, plannedDates, todayKey]);
  const moveMonth = (offset: number) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1, 12));

  return <div className="plan-calendar-sheet">
    <div className="plan-calendar-heading">
      <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month"><ChevronLeft /></button>
      <strong>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong>
      <button type="button" onClick={() => moveMonth(1)} aria-label="Next month"><ChevronRight /></button>
    </div>
    <div className="plan-calendar-weekdays">{weekdayLabels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div>
    <div className="plan-calendar-grid">{cells.map((cell, index) => cell ? <button type="button" key={cell.key} className={`${cell.key === dateKey ? "selected " : ""}${cell.hasPlan ? "has-plan" : ""}`.trim()} disabled={cell.isPast} onClick={() => onSelect(cell.key)}><span>{cell.day}</span>{cell.hasPlan && <i />}</button> : <span key={`blank-${monthKey(month)}-${index}`} />)}</div>
    <div className="plan-calendar-legend"><span><i />Has planned meals</span><span>Past days are read-only</span></div>
  </div>;
}
