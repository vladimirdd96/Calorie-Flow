import { MealEditor } from "calorie-flow-design-system";
import { meals, noop } from "./_fixtures";

export function Default() {
  return <MealEditor meal={meals[1]} onSave={noop} onClose={noop} hideCalories={false} />;
}

export function HideCalories() {
  return <MealEditor meal={meals[1]} onSave={noop} onClose={noop} hideCalories={true} />;
}
