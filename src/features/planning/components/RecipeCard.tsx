"use client";

import { BookOpen, CalendarPlus, Pencil, Share2, Trash2 } from "lucide-react";
import type { Recipe } from "@/lib/types";

export function RecipeCard({ recipe, sharing, onLog, onPlan, onEdit, onDelete, onToggleShare }: {
  recipe: Recipe;
  sharing?: boolean;
  onLog: () => void;
  onPlan: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleShare?: () => void;
}) {
  return <article className="recipe-card card">
    <div className="recipe-card-body">
      {recipe.imageUrls?.[0] ? <img className="food-avatar" src={recipe.imageUrls[0]} alt="" /> : <span className="recipe-row-icon"><BookOpen size={18} /></span>}
      <div><strong>{recipe.name}</strong><small>{recipe.servings} {recipe.servings === 1 ? "serving" : "servings"} · {Math.round(recipe.nutritionPerServing.protein)}g protein{recipe.isPublic ? " · Shared" : ""}</small></div>
    </div>
    <div className="recipe-card-actions">
      <button className="text-button" type="button" onClick={onLog}><BookOpen size={15} />Log</button>
      <button className="icon-button subtle-button" type="button" aria-label={`Plan ${recipe.name}`} onClick={onPlan}><CalendarPlus size={15} /></button>
      {onToggleShare && <button className={`icon-button subtle-button${recipe.isPublic ? " active" : ""}`} type="button" aria-label={recipe.isPublic ? `Remove ${recipe.name} from the catalogue` : `Share ${recipe.name} to the catalogue`} onClick={onToggleShare} disabled={sharing}><Share2 size={15} /></button>}
      <button className="icon-button subtle-button" type="button" aria-label={`Edit ${recipe.name}`} onClick={onEdit}><Pencil size={15} /></button>
      <button className="icon-button subtle-button danger" type="button" aria-label={`Delete ${recipe.name}`} onClick={onDelete}><Trash2 size={15} /></button>
    </div>
  </article>;
}
