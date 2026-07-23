import { CoachView } from "calorie-flow-design-system";
import { asyncNoop, noop } from "./_fixtures";

export function Default() {
  return (
    <CoachView
      configured={true}
      user={{ id: "u1", email: "alex@example.com" }}
      onOpenAccount={noop}
      onOpenAdd={noop}
      onLogCoachMeal={asyncNoop}
      hideCalories={false}
      chatTextSize="comfortable"
    />
  );
}
