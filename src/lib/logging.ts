import { localDateKey } from "./nutrition";

export function recentLogDates(today = new Date(), count = 7) {
  return Array.from({ length: Math.max(1, count) }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() - index);
    return localDateKey(date);
  });
}
