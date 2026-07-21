import type { WaterEntry } from "./types";

export function hydrationTotal(entries: WaterEntry[] | undefined, date: string) {
  return (entries || []).filter((entry) => entry.date === date).reduce((total, entry) => total + entry.amountMl, 0);
}

export function setWaterAmount(entries: WaterEntry[] | undefined, date: string, amountMl: number): WaterEntry[] {
  const safeAmount = Math.round(Math.max(0, Math.min(20_000, amountMl)));
  const remaining = (entries || []).filter((entry) => entry.date !== date);
  return safeAmount ? [...remaining, { date, amountMl: safeAmount }].sort((a, b) => a.date.localeCompare(b.date)) : remaining;
}
