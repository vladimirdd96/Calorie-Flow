import type { Food, Meal, Recipe } from "../../lib/types";

export type RepeatItem =
  | { kind: "food"; item: Food; uses: number; lastUsedAt: string }
  | { kind: "recipe"; item: Recipe; uses: number; lastUsedAt: string };

type Usage = { uses: number; lastUsedAt: string; events: Set<string> };

function usageFor(meals: Meal[], id: string, field: "foodId" | "recipeId") {
  const usage: Usage = { uses: 0, lastUsedAt: "", events: new Set() };
  for (const meal of meals) {
    if (meal[field] !== id) continue;
    const eventId = field === "recipeId" ? meal.recipeLogId || meal.id : meal.id;
    if (!usage.events.has(eventId)) {
      usage.events.add(eventId);
      usage.uses += 1;
    }
    if (meal.createdAt > usage.lastUsedAt) usage.lastUsedAt = meal.createdAt;
  }
  return usage;
}

export function repeatItems(foods: Food[], recipes: Recipe[], meals: Meal[], limit = 8): RepeatItem[] {
  const items: RepeatItem[] = [
    ...foods.map((item) => ({ kind: "food" as const, item, ...usageFor(meals, item.id, "foodId") })),
    ...recipes.map((item) => ({ kind: "recipe" as const, item, ...usageFor(meals, item.id, "recipeId") })),
  ].filter((item) => item.uses > 0);

  return items.sort((left, right) => right.uses - left.uses || right.lastUsedAt.localeCompare(left.lastUsedAt)).slice(0, limit);
}
