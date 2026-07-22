import { scaleNutrition, sumNutrition } from "../../lib/nutrition";
import type { Food, Nutrition, Recipe, RecipeIngredient } from "../../lib/types";

export function recipeLogId() {
  return `recipe-log-${crypto.randomUUID()}`;
}

export function canLogRecipeIngredients(recipe: Recipe) {
  return recipe.ingredients.some((ingredient) => Boolean(ingredient.foodId || ingredient.grams || ingredient.nutrition));
}

export function recipeIngredientFood(ingredient: RecipeIngredient, foods: Food[], replacementId?: string) {
  return foods.find((food) => food.id === replacementId) || foods.find((food) => food.id === ingredient.foodId);
}

export function recipeIngredientNutrition(ingredient: RecipeIngredient, foods: Food[], replacementId?: string): Nutrition {
  const replacement = replacementId && replacementId !== ingredient.foodId ? foods.find((food) => food.id === replacementId) : undefined;
  if (replacement) return scaleNutrition(replacement.nutrientsPer100, ingredient.grams || 100);
  if (ingredient.nutrition) return ingredient.nutrition;
  const sourceFood = recipeIngredientFood(ingredient, foods);
  if (sourceFood) return scaleNutrition(sourceFood.nutrientsPer100, ingredient.grams || 100);
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
  };
}

export function recipeNutritionForLogging(recipe: Recipe, foods: Food[], replacements: Record<string, string>) {
  if (!canLogRecipeIngredients(recipe)) return recipe.nutritionPerServing;
  return sumNutrition(recipe.ingredients.map((ingredient) => recipeIngredientNutrition(ingredient, foods, replacements[ingredient.id])));
}
