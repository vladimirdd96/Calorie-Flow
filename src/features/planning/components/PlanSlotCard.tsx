"use client";

import { BookOpen, Plus, UtensilsCrossed, X } from "lucide-react";
import type { Food, MealPlanEntry, Recipe } from "@/lib/types";

export function PlanSlotCard({ mealLabel, entry, recipe, food, onRemove, onAdd }: {
  mealLabel: string;
  entry?: MealPlanEntry;
  recipe?: Recipe;
  food?: Food;
  onRemove: () => void;
  onAdd: () => void;
}) {
  const item = recipe || food;
  const imageUrl = recipe?.imageUrls?.[0] || food?.imageUrl;
  return <article className="plan-slot-card">
    <div className="plan-slot-heading">
      <span>{mealLabel}</span>
      {entry && <button type="button" aria-label={`Remove ${mealLabel.toLowerCase()} from plan`} onClick={onRemove}><X size={14} /></button>}
    </div>
    {item ? <div className="plan-slot-recipe">
      {imageUrl ? <img className="food-avatar" src={imageUrl} alt="" /> : <span className="recipe-row-icon">{recipe ? <BookOpen size={16} /> : <UtensilsCrossed size={16} />}</span>}
      <span><strong>{item.name}</strong><small>Planned · {recipe ? `${recipe.servings} ${recipe.servings === 1 ? "serving" : "servings"}` : food?.servingLabel || "100 g"}</small></span>
      <strong>{Math.round(recipe ? recipe.nutritionPerServing.calories : food?.nutrientsPer100.calories || 0)} <small>kcal</small></strong>
    </div> : <button type="button" className="plan-slot-add" aria-label={`Add ${mealLabel.toLowerCase()} to plan`} onClick={onAdd}><Plus size={13} />Add to plan</button>}
  </article>;
}
