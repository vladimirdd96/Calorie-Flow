import { BottomNav } from "calorie-flow-design-system";

const noop = () => {};

export function Default() {
  return <BottomNav tab="today" onChange={noop} planEnabled={true} />;
}

export function CoachTabActive() {
  return <BottomNav tab="coach" onChange={noop} planEnabled={true} />;
}

export function PlanTabHidden() {
  return <BottomNav tab="today" onChange={noop} planEnabled={false} />;
}
