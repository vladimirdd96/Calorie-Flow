import type { FastingRecord } from "./types";

export function activeFast(records: FastingRecord[] | undefined) {
  return [...(records || [])].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).find((record) => !record.endedAt);
}

export function fastingProgress(startedAt: string, now: string, goalHours: number) {
  const elapsed = new Date(now).getTime() - new Date(startedAt).getTime();
  const target = Math.max(1, goalHours) * 60 * 60 * 1000;
  return Math.max(0, Math.min(1, elapsed / target));
}

export function fastingWindowHours(startedAt: string, endedAt: string) {
  return Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 36_000) / 100);
}
