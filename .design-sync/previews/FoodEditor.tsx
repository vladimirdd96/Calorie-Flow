import { FoodEditor } from "calorie-flow-design-system";
import { foods, noop } from "./_fixtures";

export function Default() {
  return <FoodEditor food={foods[0]} hideCalories={false} onSave={noop} onClose={noop} />;
}
