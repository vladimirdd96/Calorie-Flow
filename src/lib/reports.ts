import type { Meal } from "./types";

function field(value: string | number | undefined) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function mealsCsv(meals: Meal[]) {
  const header = ["Date", "Time", "Meal", "Food", "Amount", "Unit", "Grams", "Calories", "Protein g", "Carbs g", "Fat g", "Fibre g", "Sugar g"];
  const rows = meals.slice().sort((a, b) => (a.loggedDate || a.createdAt).localeCompare(b.loggedDate || b.createdAt)).map((meal) => [meal.loggedDate || meal.createdAt.slice(0, 10), new Date(meal.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }), meal.mealType, meal.name, meal.amount, meal.unit, meal.grams, meal.nutrition.calories, meal.nutrition.protein, meal.nutrition.carbs, meal.nutrition.fat, meal.nutrition.fiber, meal.nutrition.sugar].map(field).join(","));
  return [header.map(field).join(","), ...rows].join("\n");
}
