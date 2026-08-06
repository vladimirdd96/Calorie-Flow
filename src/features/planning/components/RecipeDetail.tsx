"use client";

import { Minus, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { humanizeTaxonomyKey, scaleIngredientQuantity } from "@/lib/planning";
import type { DietaryTag } from "@/lib/types";

export type RecipeDetailIngredient = { id: string; name: string; quantity?: string };

export type RecipeDetailAction = {
  key: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  note?: string;
};

/** Read-only recipe view shared by the catalogue detail sheet and the personal recipe detail sheet. */
export function RecipeDetail({
  name, imageUrl, imageCredit, eyebrow, cuisine, dietaryTags, hideCalories, caloriesPerServing,
  servingsCount, onServingsChange, ingredients, scaleFactor, instructions, checkedSteps, onToggleStep, actions,
}: {
  name: string;
  imageUrl?: string;
  imageCredit?: { label: string; sourceUrl: string };
  eyebrow: string;
  cuisine?: string;
  dietaryTags?: DietaryTag[];
  hideCalories?: boolean;
  caloriesPerServing: number;
  servingsCount: number;
  onServingsChange: (count: number) => void;
  ingredients: RecipeDetailIngredient[];
  scaleFactor: number;
  instructions: string[];
  checkedSteps: Set<number>;
  onToggleStep: (index: number) => void;
  actions: RecipeDetailAction[];
}) {
  return <div className="recipe-view-detail">
    {imageUrl && <div className="recipe-view-photo">
      <img src={imageUrl} alt="" />
      {imageCredit && <a href={imageCredit.sourceUrl} target="_blank" rel="noopener noreferrer">via {imageCredit.label} ↗</a>}
    </div>}
    <div className="sheet-header"><div><span className="eyebrow">{eyebrow}</span><h2>{name}</h2></div><span /></div>
    {(cuisine || (dietaryTags && dietaryTags.length > 0)) && <div className="catalogue-badges">
      {cuisine && <span className="catalogue-badge">{humanizeTaxonomyKey(cuisine)}</span>}
      {dietaryTags?.map((tag) => <span key={tag} className="catalogue-badge">{humanizeTaxonomyKey(tag)}</span>)}
    </div>}
    <div className="catalogue-servings-row">
      <span>{!hideCalories && `${Math.round(caloriesPerServing)} kcal per serving · `}Servings</span>
      <div className="catalogue-servings-stepper">
        <button type="button" aria-label="Fewer servings" disabled={servingsCount <= 1} onClick={() => onServingsChange(Math.max(1, servingsCount - 1))}><Minus size={14} /></button>
        <strong>{servingsCount}</strong>
        <button type="button" aria-label="More servings" onClick={() => onServingsChange(Math.min(100, servingsCount + 1))}><Plus size={14} /></button>
      </div>
    </div>
    <ul className="recipe-view-ingredients">{ingredients.map((ingredient) => <li key={ingredient.id}>{ingredient.quantity && <strong>{scaleIngredientQuantity(ingredient.quantity, scaleFactor)}</strong>}<span>{ingredient.name}</span></li>)}</ul>
    <h3 className="catalogue-instructions-heading">Instructions</h3>
    {instructions.length > 0
      ? <ol className="catalogue-instructions">
          {instructions.map((step, index) => <li key={index} className={checkedSteps.has(index) ? "done" : ""}>
            <button type="button" onClick={() => onToggleStep(index)}>{step}</button>
          </li>)}
        </ol>
      : <p className="recipe-view-no-instructions">No steps added yet — go by the ingredients, or check back once they&apos;re added.</p>}
    <div className="sheet-actions recipe-view-actions">
      {actions.map(({ key, label, icon: Icon, onClick, variant = "secondary", disabled, note }) => <span key={key} className="recipe-view-action">
        <button type="button" className={variant === "primary" ? "primary-button" : "secondary-button"} onClick={onClick} disabled={disabled}><Icon size={16} />{label}</button>
        {note && <small>{note}</small>}
      </span>)}
    </div>
  </div>;
}
