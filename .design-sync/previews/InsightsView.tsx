import { InsightsView } from "calorie-flow-design-system";
import { meals, noop, profile } from "./_fixtures";

export function Default() {
  return <InsightsView meals={meals} profile={profile} onSave={noop} weightTrackingEnabled={true} />;
}
