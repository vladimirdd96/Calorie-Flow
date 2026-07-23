import { AddFoodSheet } from "calorie-flow-design-system";
import { asyncNoop, foods, meals, noop, recipes } from "./_fixtures";

export function Default() {
  return (
    <AddFoodSheet
      foods={foods}
      meals={meals}
      recipes={recipes}
      onLog={noop}
      onMealPhoto={noop}
      onSaveFood={asyncNoop}
      onSelectRecipe={noop}
      hideCalories={false}
    />
  );
}
