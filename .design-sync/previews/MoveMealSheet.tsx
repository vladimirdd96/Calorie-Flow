import { MoveMealSheet } from "calorie-flow-design-system";
import { meals, noop } from "./_fixtures";

export function Default() {
  return <MoveMealSheet meal={meals[1]} onMove={noop} onClose={noop} />;
}
