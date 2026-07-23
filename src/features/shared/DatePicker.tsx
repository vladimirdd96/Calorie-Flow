"use client";

import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { localDateKey } from "@/lib/nutrition";

type CalendarPickerProps = {
  value: string;
  onChange: (value: string) => void;
  minDate?: string;
  maxDate?: string;
  renderDay?: (date: string) => ReactNode;
  getDayLabel?: (date: string) => string;
  showFooter?: boolean;
  onClear?: () => void;
  className?: string;
};

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateFromKey(value: string) {
  return new Date(`${value}T12:00:00`);
}

function isMonthBefore(left: Date, right: Date) {
  return monthKey(left) < monthKey(right);
}

function isMonthAfter(left: Date, right: Date) {
  return monthKey(left) > monthKey(right);
}

export function CalendarPicker({ value, onChange, minDate, maxDate = localDateKey(), renderDay, getDayLabel, showFooter = false, onClear, className = "" }: CalendarPickerProps) {
  const selectedDate = dateFromKey(value || maxDate || localDateKey());
  const [monthStart, setMonthStart] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 12));
  const minMonth = minDate ? dateFromKey(minDate) : undefined;
  const maxMonth = maxDate ? dateFromKey(maxDate) : undefined;
  const monthTitle = monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const firstWeekday = (monthStart.getDay() + 6) % 7;
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const calendarDays = useMemo(() => Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - firstWeekday + 1;
    if (day < 1 || day > daysInMonth) return undefined;
    return localDateKey(new Date(monthStart.getFullYear(), monthStart.getMonth(), day, 12));
  }), [daysInMonth, firstWeekday, monthStart]);
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const previousMonth = () => setMonthStart((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1, 12));
  const nextMonth = () => setMonthStart((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1, 12));
  const canGoPrevious = !minMonth || !isMonthBefore(monthStart, minMonth);
  const canGoNext = !maxMonth || !isMonthAfter(monthStart, maxMonth);
  const isDisabled = (date: string) => Boolean((minDate && date < minDate) || (maxDate && date > maxDate));

  return <div className={`calendar-picker ${className}`.trim()}>
    <div className="calendar-toolbar"><button type="button" className="icon-button ghost" onClick={previousMonth} disabled={!canGoPrevious} aria-label="Previous month"><ChevronLeft /></button><strong>{monthTitle}</strong><button type="button" className="icon-button ghost" onClick={nextMonth} disabled={!canGoNext} aria-label="Next month"><ChevronRight /></button></div>
    <div className="calendar-weekdays" aria-hidden="true">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
    <div className="calendar-grid" role="grid" aria-label={monthTitle}>
      {calendarDays.map((date, index) => date ? <button key={date} type="button" className={`calendar-day ${date === value ? "selected" : ""} ${isDisabled(date) ? "outside-range" : ""}`} role="gridcell" onClick={() => onChange(date)} disabled={isDisabled(date)} aria-label={getDayLabel?.(date) || dateFromKey(date).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}><span>{dateFromKey(date).getDate()}</span>{renderDay?.(date)}</button> : <span className="calendar-day empty" key={`empty-${index}`} aria-hidden="true" />)}
    </div>
    {showFooter && <div className="calendar-footer">{onClear && <button type="button" className="text-button" onClick={onClear}>Clear</button>}<button type="button" className="text-button" onClick={() => onChange(maxDate || localDateKey())}>Today</button></div>}
  </div>;
}

type DatePickerFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  className?: string;
};

export function DatePickerField({ label, value, onChange, min, max, required = false, className = "" }: DatePickerFieldProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 320 });
  const updatePosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(342, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const top = Math.min(rect.bottom + 8, window.innerHeight - 460);
    setPosition({ top: Math.max(12, top), left, width });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const closeOnOutside = (event: PointerEvent) => {
      if (!popoverRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const formattedValue = value ? dateFromKey(value).toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" }) : "Choose a date";
  const chooseDate = (next: string) => { onChange(next); setOpen(false); triggerRef.current?.focus(); };
  const clear = () => { onChange(""); setOpen(false); triggerRef.current?.focus(); };
  const picker = open ? <div ref={popoverRef} className="date-picker-popover" role="dialog" aria-label={`${label} calendar`} style={{ top: position.top, left: position.left, width: position.width }}><CalendarPicker value={value} onChange={chooseDate} minDate={min} maxDate={max} showFooter={!required} onClear={required ? undefined : clear} /></div> : null;

  return <label className={`date-picker-field ${className}`.trim()}><span>{label}</span><button ref={triggerRef} type="button" className={`date-picker-trigger${open ? " open" : ""}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((current) => !current)}><span>{formattedValue}</span><CalendarDays size={17} aria-hidden="true" /></button>{typeof document !== "undefined" && createPortal(picker, document.body)}</label>;
}
