import { TodayView } from "calorie-flow-design-system";
import type { Meal, Profile } from "calorie-flow-design-system";

const noop = () => {};
const asyncNoop = async () => {};

const baseProfile: Profile = {
  name: "Alex",
  sex: "female",
  age: 32,
  heightCm: 168,
  weightKg: 63,
  activity: "moderate",
  goalMode: "lose",
  dietPreset: "balanced",
  calorieTarget: 1850,
  proteinTarget: 130,
  carbsTarget: 180,
  fatTarget: 60,
  fiberTarget: 28,
  hideCalories: false,
  onboardingDone: true,
  carbDisplay: "total",
  planEnabled: true,
  recipes: [],
};

const dateKey = "2026-07-22";

function meal(partial: Partial<Meal> & Pick<Meal, "id" | "name" | "mealType" | "nutrition">): Meal {
  return {
    amount: 1,
    unit: "serving",
    grams: 200,
    createdAt: `${dateKey}T08:00:00.000Z`,
    loggedDate: dateKey,
    source: "seed",
    ...partial,
  };
}

const dailyMeals: Meal[] = [
  meal({ id: "m1", name: "Greek yogurt with berries", mealType: "breakfast", nutrition: { calories: 320, protein: 24, carbs: 38, fat: 8, fiber: 5, sugar: 22 } }),
  meal({ id: "m2", name: "Grilled chicken salad", mealType: "lunch", nutrition: { calories: 480, protein: 42, carbs: 28, fat: 20, fiber: 9, sugar: 6 } }),
  meal({ id: "m3", name: "Salmon, rice & broccoli", mealType: "dinner", nutrition: { calories: 610, protein: 48, carbs: 55, fat: 22, fiber: 7, sugar: 4 } }),
  meal({ id: "m4", name: "Almonds", mealType: "snack", nutrition: { calories: 160, protein: 6, carbs: 6, fat: 14, fiber: 3, sugar: 1 } }),
];

const todayViewHandlers = {
  onDateChange: noop,
  onAdd: noop,
  onOpenCoach: noop,
  onDelete: noop,
  onEdit: noop,
  onOpenDetails: noop,
  onOpenNutritionDetails: noop,
  onOpenImage: noop,
  onDropMeal: noop,
  onDuplicate: noop,
  onMove: noop,
  onDismissHomeScreenPrompt: noop,
  onOpenCalendar: noop,
  onSaveProfile: noop,
  onSaveRecipe: asyncNoop,
};

export function Default() {
  return (
    <TodayView
      profile={baseProfile}
      foods={[]}
      recipes={[]}
      meals={dailyMeals}
      dateKey={dateKey}
      syncLabel="Synced privately"
      showHomeScreenPrompt={false}
      {...todayViewHandlers}
    />
  );
}

export function EmptyDay() {
  return (
    <TodayView
      profile={baseProfile}
      foods={[]}
      recipes={[]}
      meals={[]}
      dateKey={dateKey}
      syncLabel="Private on this device"
      showHomeScreenPrompt={true}
      {...todayViewHandlers}
    />
  );
}

export function MacroFocusMode() {
  return (
    <TodayView
      profile={{ ...baseProfile, hideCalories: true, carbDisplay: "net" }}
      foods={[]}
      recipes={[]}
      meals={dailyMeals}
      dateKey={dateKey}
      syncLabel="Synced privately"
      showHomeScreenPrompt={false}
      {...todayViewHandlers}
    />
  );
}
