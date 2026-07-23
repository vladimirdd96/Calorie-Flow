import { PlanView } from "calorie-flow-design-system";
import { asyncNoop, foods, meals, noop, profile } from "./_fixtures";

export function Default() {
  return <PlanView profile={profile} foods={foods} meals={meals} onSaveFood={asyncNoop} onSave={noop} onLog={asyncNoop} />;
}
