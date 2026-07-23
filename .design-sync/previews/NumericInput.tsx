import { NumericInput } from "calorie-flow-design-system";
import { noop } from "./_fixtures";

export function Default() {
  return (
    <label>
      <span>Servings</span>
      <NumericInput required min="0.5" max="100" step="0.5" value="2" onChange={noop} />
    </label>
  );
}
