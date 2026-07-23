import { WeightTrackingPrompt } from "calorie-flow-design-system";
import { noop } from "./_fixtures";

export function Default() {
  return <WeightTrackingPrompt onEnable={noop} onDisable={noop} onDefer={noop} />;
}
