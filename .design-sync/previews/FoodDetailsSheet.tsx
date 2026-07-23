import { FoodDetailsSheet } from "calorie-flow-design-system";
import { foods, noop } from "./_fixtures";

export function Default() {
  return <FoodDetailsSheet food={foods[0]} hideCalories={false} onLog={noop} onEdit={noop} />;
}
