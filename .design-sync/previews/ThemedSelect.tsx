import { ThemedSelect } from "calorie-flow-design-system";
import { noop } from "./_fixtures";

const mealTypeOptions = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

export function Default() {
  return (
    <label>
      <span>Meal</span>
      <ThemedSelect ariaLabel="Planned meal" value="lunch" onChange={noop} options={mealTypeOptions} />
    </label>
  );
}
