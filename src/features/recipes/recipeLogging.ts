import { nutritionPer100Grams, scaleNutrition, sumNutrition } from "../../lib/nutrition";
import type { Food, Meal, Nutrition, Recipe, RecipeIngredient } from "../../lib/types";

export function recipeLogId() {
  return `recipe-log-${crypto.randomUUID()}`;
}

export function canLogRecipeIngredients(recipe: Recipe) {
  return recipe.ingredients.some((ingredient) => Boolean(ingredient.foodId || ingredient.grams || ingredient.nutrition));
}

export function recipeIngredientFood(ingredient: RecipeIngredient, foods: Food[], replacementId?: string) {
  return foods.find((food) => food.id === replacementId) || foods.find((food) => food.id === ingredient.foodId);
}

export function recipeIngredientNutrition(ingredient: RecipeIngredient, foods: Food[], replacementId?: string, macroDigits = 1): Nutrition {
  const replacement = replacementId && replacementId !== ingredient.foodId ? foods.find((food) => food.id === replacementId) : undefined;
  if (replacement) return scaleNutrition(replacement.nutrientsPer100, ingredient.grams || 100, macroDigits);
  if (ingredient.nutrition) return ingredient.nutrition;
  const sourceFood = recipeIngredientFood(ingredient, foods);
  if (sourceFood) return scaleNutrition(sourceFood.nutrientsPer100, ingredient.grams || 100, macroDigits);
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
  };
}

export function recipeNutritionForLogging(recipe: Recipe, foods: Food[], replacements: Record<string, string>, macroDigits = 1) {
  if (!canLogRecipeIngredients(recipe)) return recipe.nutritionPerServing;
  return sumNutrition(recipe.ingredients.map((ingredient) => recipeIngredientNutrition(ingredient, foods, replacements[ingredient.id], macroDigits)));
}

/** Grams for one serving: explicit value, else summed ingredient grams, else a flat fallback. */
export function recipeServingGrams(recipe: Recipe): number {
  if (recipe.servingGrams) return recipe.servingGrams;
  const total = recipe.ingredients.reduce((sum, ingredient) => sum + (ingredient.grams || 0), 0);
  return total > 0 ? total : 100;
}

/**
 * Represents a saved recipe as a Food so portion-picking UI (unit switching, gram entry,
 * live nutrition preview) can be reused as-is for logging a recipe.
 */
export function recipeAsFood(recipe: Recipe, foods: Food[], replacements: Record<string, string> = {}, macroDigits = 1): Food {
  const servingGrams = recipeServingGrams(recipe);
  const nutritionPerServingUnit = recipeNutritionForLogging(recipe, foods, replacements, macroDigits);
  return {
    id: recipe.id,
    name: recipe.name,
    imageUrl: recipe.imageUrls?.[0],
    servingGrams,
    packageGrams: servingGrams * Math.max(1, recipe.servings),
    nutrientsPer100: nutritionPer100Grams(nutritionPerServingUnit, servingGrams, macroDigits),
    source: "custom",
  };
}

/**
 * Represents an already-logged meal as a Food, so its exact recorded nutrition (not the
 * recipe's current defaults) drives portion editing. Falls back to the recipe's batch size
 * for the "package" unit when the meal is linked to one.
 */
export function mealAsFood(meal: Meal, recipe?: Recipe): Food {
  const grams = meal.grams > 0 ? meal.grams : 100;
  const food: Food = {
    id: meal.foodId || meal.recipeId || meal.id,
    name: meal.name,
    brand: meal.brand,
    imageUrl: meal.imageUrl,
    servingGrams: grams,
    nutrientsPer100: nutritionPer100Grams(meal.nutrition, grams),
    source: meal.source,
  };
  if (recipe) food.packageGrams = recipeServingGrams(recipe) * Math.max(1, recipe.servings);
  return food;
}
