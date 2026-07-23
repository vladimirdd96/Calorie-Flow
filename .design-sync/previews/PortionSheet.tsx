import { PortionSheet } from "calorie-flow-design-system";
import { foods, noop } from "./_fixtures";

export function Default() {
  return <PortionSheet food={foods[0]} onLog={noop} onClose={noop} hideCalories={false} />;
}
