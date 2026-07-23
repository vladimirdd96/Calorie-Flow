import { DuplicateMealSheet } from "calorie-flow-design-system";
import { meals, noop } from "./_fixtures";

export function Default() {
  return <DuplicateMealSheet meal={meals[1]} onDuplicate={noop} onClose={noop} />;
}
