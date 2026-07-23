import { RecipeLogSheet } from "calorie-flow-design-system";
import { asyncNoop, foods, meals, noop, recipes } from "./_fixtures";

export function Default() {
  return <RecipeLogSheet recipe={recipes[0]} foods={foods} meals={meals} onSaveFood={asyncNoop} onLog={asyncNoop} onSaveRecipe={asyncNoop} onClose={noop} />;
}

export function EditingLoggedMeal() {
  return <RecipeLogSheet recipe={recipes[0]} foods={foods} meals={meals} onSaveFood={asyncNoop} onLog={asyncNoop} onSaveEdit={asyncNoop} editingMeal={meals[1]} onClose={noop} />;
}
