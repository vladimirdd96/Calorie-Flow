import type { WaterEntry } from "./types";

export function hydrationTotal(entries: WaterEntry[] | undefined, date: string) {
  return (Array.isArray(entries) ? entries : []).filter((entry) => entry.date === date).reduce((total, entry) => total + entry.amountMl, 0);
}

export function hydrationDayTotals(entries: WaterEntry[] | undefined): Array<{ date: string; amountMl: number }> {
  const totals = (Array.isArray(entries) ? entries : []).reduce((days, entry) => {
    if (typeof entry?.date !== "string" || !Number.isFinite(entry.amountMl)) return days;
    days.set(entry.date, (days.get(entry.date) ?? 0) + entry.amountMl);
    return days;
  }, new Map<string, number>());
  return Array.from(totals, ([date, amountMl]) => ({ date, amountMl })).filter((day) => day.amountMl > 0).sort((a, b) => a.date.localeCompare(b.date));
}

export function setWaterAmount(entries: WaterEntry[] | undefined, date: string, amountMl: number): WaterEntry[] {
  const safeAmount = roundDecimal(Math.max(0, Math.min(20_000, amountMl)));
  const remaining = (Array.isArray(entries) ? entries : []).filter((entry) => entry.date !== date);
  return safeAmount ? [...remaining, { date, amountMl: safeAmount }].sort((a, b) => a.date.localeCompare(b.date)) : remaining;
}
import { roundDecimal } from "./decimal";
