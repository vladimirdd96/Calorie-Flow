import { CalendarSheet } from "calorie-flow-design-system";
import { dateKey, meals, noop, profile } from "./_fixtures";

export function Default() {
  return <CalendarSheet dateKey={dateKey} meals={meals} profile={profile} onDateChange={noop} onClose={noop} />;
}
