import { ClearableInput } from "calorie-flow-design-system";
import { noop } from "./_fixtures";

export function Default() {
  return (
    <label>
      <span>Email</span>
      <ClearableInput type="email" autoComplete="email" value="you@example.com" onChange={noop} onClear={noop} placeholder="you@example.com" clearLabel="Clear email" />
    </label>
  );
}

export function Empty() {
  return (
    <label>
      <span>Message the Coach</span>
      <ClearableInput value="" onChange={noop} onClear={noop} placeholder="Ask about dinner, recipes, or your food log…" clearLabel="Clear message" />
    </label>
  );
}
