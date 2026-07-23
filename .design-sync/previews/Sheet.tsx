import { Sheet } from "calorie-flow-design-system";

const noop = () => {};

export function Default() {
  return (
    <Sheet onClose={noop} label="Edit meal">
      <div className="sheet-header">
        <div>
          <span className="eyebrow">Lunch</span>
          <h2>Grilled chicken salad</h2>
        </div>
        <span />
      </div>
      <p>480 kcal · 42g protein · 28g carbs · 20g fat</p>
    </Sheet>
  );
}

export function Wide() {
  return (
    <Sheet onClose={noop} label="Calendar" wide>
      <div className="sheet-header">
        <div>
          <span className="eyebrow">Your diary</span>
          <h2>Month at a glance</h2>
        </div>
        <span />
      </div>
      <p>Tap a day to jump to its log.</p>
    </Sheet>
  );
}
