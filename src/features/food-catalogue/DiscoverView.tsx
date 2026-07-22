"use client";
/* eslint-disable @next/next/no-img-element -- product thumbnails are dynamic user content. */

import { BookOpen, ChevronDown, ChevronRight, ImagePlus, Mic, Package, Plus, Search } from "lucide-react";
import type { AddFoodView } from "@/features/food-capture/types";
import { repeatItems, type RepeatItem } from "@/features/recipes/repeatItems";
import type { Food, Meal, Recipe } from "@/lib/types";

function FoodAvatar({ food }: { food: Food }) {
  if (food.imageUrl) return <img className="food-avatar" src={food.imageUrl} alt="" />;
  return <div className="food-avatar fallback">{food.name.slice(0, 1).toUpperCase()}</div>;
}

function FoodRow({ food, onSelect, hideCalories }: { food: Food; onSelect: () => void; hideCalories: boolean }) {
  const detail = food.brand || (food.source === "custom" ? "Your custom food" : food.source === "seed" ? food.servingLabel || "Reference food" : food.source === "food-data-central" ? "USDA FoodData Central" : food.source === "restaurant" ? "Restaurant menu" : "Saved food");
  return <button className="food-row" onClick={onSelect}><FoodAvatar food={food} /><span className="food-copy"><strong>{food.name}</strong><small>{detail}</small></span>{!hideCalories && <span className="food-calories"><strong>{Math.round(food.nutrientsPer100.calories)}</strong><small>kcal / 100 g</small></span>}<ChevronRight size={18} /></button>;
}

function RecipeRow({ recipe, onSelect, hideCalories }: { recipe: Recipe; onSelect: () => void; hideCalories: boolean }) {
  return <button className="food-row recipe-row" onClick={onSelect}><span className="recipe-row-icon"><BookOpen size={18} /></span><span className="food-copy"><strong>{recipe.name}</strong><small>{recipe.ingredients.length} {recipe.ingredients.length === 1 ? "food" : "foods"} · saved recipe</small></span>{!hideCalories && <span className="food-calories"><strong>{Math.round(recipe.nutritionPerServing.calories)}</strong><small>kcal total</small></span>}<ChevronRight size={18} /></button>;
}

export function DiscoverView({ foods, recipes, meals, onSelect, onSelectRecipe, onAdd, hideCalories }: { foods: Food[]; recipes: Recipe[]; meals: Meal[]; onSelect: (food: Food) => void; onSelectRecipe: (recipe: Recipe) => void; onAdd: (view: AddFoodView) => void; hideCalories: boolean }) {
  const repeat = repeatItems(foods, recipes, meals);
  const personalFoods = foods.filter((food) => food.source !== "seed").sort((left, right) => (right.lastUsedAt || "").localeCompare(left.lastUsedAt || ""));
  const savedCount = personalFoods.length + recipes.length;
  return <main className="page discover-page"><header className="page-header"><span className="eyebrow">Food library</span><h1>Find or add food</h1><p>Search your saved foods, repeat a favourite, or log a recipe without rebuilding it.</p></header><div className="discover-actions"><button type="button" className="primary-button" onClick={() => onAdd("search")}><Search size={17} />Search foods</button><button type="button" className="secondary-button" onClick={() => onAdd("scan")}><Package size={17} />Scan barcode</button><button type="button" className="secondary-button" onClick={() => onAdd("manual")}><Plus size={17} />Add manually</button><button type="button" className="secondary-button" onClick={() => onAdd("quick")}><Mic size={17} />Quick macros</button><button type="button" className="secondary-button" onClick={() => onAdd("label")}><ImagePlus size={17} />Read label</button></div>{repeat.length > 0 && <section className="food-library" aria-labelledby="repeat-items-heading"><div className="section-heading"><div><span className="eyebrow">Repeat without searching</span><h2 id="repeat-items-heading">Most picked</h2></div><span className="subtle">Based on your diary</span></div><div className="food-list card">{repeat.map((entry: RepeatItem) => entry.kind === "food" ? <FoodRow key={`food-${entry.item.id}`} food={entry.item} hideCalories={hideCalories} onSelect={() => onSelect(entry.item)} /> : <RecipeRow key={`recipe-${entry.item.id}`} recipe={entry.item} hideCalories={hideCalories} onSelect={() => onSelectRecipe(entry.item)} />)}</div></section>}<section className="food-library" aria-labelledby="recipes-heading"><div className="section-heading"><div><span className="eyebrow">Made once, ready again</span><h2 id="recipes-heading">Your recipes</h2></div><span className="subtle">{recipes.length} saved</span></div>{recipes.length ? <div className="food-list card">{recipes.map((recipe) => <RecipeRow key={recipe.id} recipe={recipe} hideCalories={hideCalories} onSelect={() => onSelectRecipe(recipe)} />)}</div> : <div className="empty-state card"><span className="action-icon mint"><BookOpen size={22} /></span><strong>Your saved recipes will appear here.</strong><p>Save a meal from Today and it will be ready to log here.</p></div>}</section>{personalFoods.length > 0 && <details className="saved-foods-disclosure card"><summary><span className="saved-foods-copy"><span className="eyebrow">Your shelf</span><strong>Saved foods</strong><small>{savedCount} saved item{savedCount === 1 ? "" : "s"}</small></span><ChevronDown size={18} aria-hidden="true" /></summary><div className="food-list saved-food-list">{personalFoods.map((food) => <FoodRow key={food.id} food={food} hideCalories={hideCalories} onSelect={() => onSelect(food)} />)}</div></details>}</main>;
}
