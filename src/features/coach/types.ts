import type { AddFoodView } from "@/features/food-capture/types";
import type { CoachMealAction, CoachMealChoice, CoachMessage, MealType } from "@/lib/types";

export type AddView = AddFoodView;

export const chatTextSizes = { compact: "compact", comfortable: "comfortable", large: "large" } as const;

export type ChatTextSize = typeof chatTextSizes[keyof typeof chatTextSizes];

const mealLabels: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export { mealLabels };

export type DisplayCoachMessage = CoachMessage & { imageUrl?: string; sources?: Array<{ title: string; url: string }>; mealAction?: CoachMealAction; mealChoices?: CoachMealChoice[] };

/**
 * What went wrong decides what the user can do about it, so the banner carries
 * its own recovery instead of always offering to reload the history.
 */
export const coachErrorKinds = {
  history: "history",
  reply: "reply",
  sync: "sync",
  notice: "notice",
} as const;

export type CoachErrorKind = typeof coachErrorKinds[keyof typeof coachErrorKinds];

export type CoachError = { kind: CoachErrorKind; message: string };
