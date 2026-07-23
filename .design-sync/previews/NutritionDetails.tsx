import { NutritionDetails } from "calorie-flow-design-system";
import { meals, noop, recipes } from "./_fixtures";

export function Default() {
  return <NutritionDetails meal={meals[2]} hideCalories={false} onClose={noop} />;
}

export function AsSavedRecipe() {
  return <NutritionDetails meal={{ ...meals[0], recipeId: recipes[0].id }} hideCalories={false} recipe={recipes[0]} onClose={noop} />;
}
