import { DiscoverView } from "calorie-flow-design-system";
import { foods, meals, noop, recipes } from "./_fixtures";

export function Default() {
  return <DiscoverView foods={foods} recipes={recipes} meals={meals} onSelect={noop} onSelectRecipe={noop} onAdd={noop} hideCalories={false} />;
}
