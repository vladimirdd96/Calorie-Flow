import { MeasurementPreferencePrompt } from "calorie-flow-design-system";
import { noop, profile } from "./_fixtures";

export function Default() {
  return <MeasurementPreferencePrompt profile={profile} onSave={noop} />;
}
