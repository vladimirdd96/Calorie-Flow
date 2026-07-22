import type { AddFoodView } from "@/features/food-capture/types";
import type { CoachMealAction, CoachMealChoice, CoachMessage, MealType } from "@/lib/types";

export type AddView = AddFoodView;

export type CoachSection = "chat" | "groceries";

export type GroceryList = { id: string; name: string; items: GroceryItem[]; createdAt: string; updatedAt: string };

export type ChatTextSize = typeof chatTextSizes[keyof typeof chatTextSizes];

const GROCERY_ITEMS_SETTING = "coach:grocery-items";

function isGroceryItem(value: unknown): value is GroceryItem {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.name === "string" && typeof record.checked === "boolean" && typeof record.addedAt === "string";
}

export { GROCERY_ITEMS_SETTING, isGroceryItem };

export function hideCalorieValues(content: string) {
  return content.replace(/\b\d[\d,.]*\s*(?:-|–|—)?\s*(?:kcal|calories?)\b/gi, "energy hidden");
}

const mealLabels: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export { mealLabels };

export type GroceryItem = { id: string; name: string; checked: boolean; addedAt: string };

const chatTextSizes = { compact: "compact", comfortable: "comfortable", large: "large" } as const;

export type DisplayCoachMessage = CoachMessage & { imageUrl?: string; sources?: Array<{ title: string; url: string }>; mealAction?: CoachMealAction; mealChoices?: CoachMealChoice[] };

function groceryItemsFromReply(content: string) {
  const section = content.match(/(?:^|\n)\s*(?:\*\*)?grocery list(?:\*\*)?\s*:?\s*\n([\s\S]*)/i)?.[1];
  if (!section) return [];
  return section.split("\n")
    .map((line) => line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.+?)\s*$/)?.[1]?.replace(/\*\*/g, "").trim())
    .filter((item): item is string => Boolean(item))
    .slice(0, 24);
}

function titleFromQuestion(question: string) {
  const normalized = question.replace(/\s+/g, " ").trim();
  const firstSentence = normalized.split(/(?<=[.!?])\s+/)[0] || normalized;
  return firstSentence.length > 54 ? `${firstSentence.slice(0, 53).trimEnd()}…` : firstSentence;
}
