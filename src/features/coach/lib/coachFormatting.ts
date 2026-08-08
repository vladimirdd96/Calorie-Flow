import { localDateKey } from "@/lib/nutrition";

/**
 * Safety net for history written before the user hid energy values. Redacts the
 * number rather than rewriting the sentence around it, so the gap reads as a
 * deliberate omission instead of broken prose.
 */
export function hideCalorieValues(content: string) {
  return content.replace(/\b\d[\d,.]*\s*(?:-|–|—)?\s*(?:kcal|calories?)\b/gi, "[hidden]");
}

export function groceryItemsFromReply(content: string) {
  const section = content.match(/(?:^|\n)\s*(?:\*\*)?grocery list(?:\*\*)?\s*:?\s*\n([\s\S]*)/i)?.[1];
  if (!section) return [];
  return section.split("\n")
    .map((line) => line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.+?)\s*$/)?.[1]?.replace(/\*\*/g, "").trim())
    .filter((item): item is string => Boolean(item))
    .slice(0, 24);
}

export function titleFromQuestion(question: string) {
  const normalized = question.replace(/\s+/g, " ").trim();
  const firstSentence = normalized.split(/(?<=[.!?])\s+/)[0] || normalized;
  return firstSentence.length > 54 ? `${firstSentence.slice(0, 53).trimEnd()}…` : firstSentence;
}

/** Day heading for a thread that spans more than one day. */
export function dayLabel(iso: string) {
  const date = new Date(iso);
  const key = localDateKey(date);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === localDateKey()) return "Today";
  if (key === localDateKey(yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export const messageTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
