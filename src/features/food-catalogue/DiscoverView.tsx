"use client";
/* eslint-disable @next/next/no-img-element -- product thumbnails are dynamic user content. */

import { BookOpen, ChevronDown, ChevronRight, ImagePlus, Plus, ScanLine, Search, WifiOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClearableInput } from "@/features/shared/ClearableInput";
import type { AddFoodView } from "@/features/food-capture/types";
import { repeatItems, type RepeatItem } from "@/features/recipes/repeatItems";
import { searchOpenFoodFacts } from "@/lib/openfoodfacts";
import type { Food, Meal, Recipe } from "@/lib/types";

function FoodAvatar({ food }: { food: Food }) {
  if (food.imageUrl) return <img className="food-avatar" src={food.imageUrl} alt="" />;
  return <div className="food-avatar fallback">{food.name.slice(0, 1).toUpperCase()}</div>;
}
function FoodRow({ food, onSelect, hideCalories }: { food: Food; onSelect: () => void; hideCalories: boolean }) {
  const detail = food.brand || (food.source === "custom" ? "Your custom food" : food.source === "seed" ? food.servingLabel || "Reference food" : food.source === "food-data-central" ? "USDA FoodData Central" : food.source === "restaurant" ? "Restaurant menu" : "Saved food");
  return <button className="food-row" type="button" onClick={onSelect}><FoodAvatar food={food} /><span className="food-copy"><strong>{food.name}</strong><small>{detail}</small></span>{!hideCalories && <span className="food-calories"><strong>{Math.round(food.nutrientsPer100.calories)}</strong><small>kcal / 100 g</small></span>}<ChevronRight size={18} /></button>;
}

function RecipeRow({ recipe, onSelect, hideCalories }: { recipe: Recipe; onSelect: () => void; hideCalories: boolean }) {
  return <button className="food-row recipe-row" type="button" onClick={onSelect}>{recipe.imageUrls?.[0] ? <img className="food-avatar" src={recipe.imageUrls[0]} alt="" /> : <span className="recipe-row-icon"><BookOpen size={18} /></span>}<span className="food-copy"><strong>{recipe.name}</strong><small>{recipe.ingredients.length} {recipe.ingredients.length === 1 ? "food" : "foods"} · saved recipe</small></span>{!hideCalories && <span className="food-calories"><strong>{Math.round(recipe.nutritionPerServing.calories)}</strong><small>kcal total</small></span>}<ChevronRight size={18} /></button>;
}

type LocalSearchResult = { kind: "food"; item: Food } | { kind: "recipe"; item: Recipe };

function matchScore(value: string, query: string, boost = 0) {
  const normalized = value.toLocaleLowerCase();
  if (normalized === query) return 100 + boost;
  if (normalized.startsWith(query)) return 80 + boost;
  if (normalized.split(/\s+/).some((word) => word.startsWith(query))) return 65 + boost;
  return 40 + boost;
}

export function DiscoverView({ foods, recipes, meals, onSelect, onSelectRecipe, onAdd, hideCalories }: { foods: Food[]; recipes: Recipe[]; meals: Meal[]; onSelect: (food: Food) => void; onSelectRecipe: (recipe: Recipe) => void; onAdd: (view: AddFoodView) => void; hideCalories: boolean }) {
  const [query, setQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const searchRequestRef = useRef(0);
  const repeat = repeatItems(foods, recipes, meals);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const diaryFoodIds = useMemo(() => new Set(meals.map((meal) => meal.foodId).filter((id): id is string => Boolean(id))), [meals]);
  const personalFoods = useMemo(() => foods.filter((food) => food.source !== "seed"), [foods]);
  const savedFoods = useMemo(() => [...personalFoods].sort((left, right) => (right.lastUsedAt || "").localeCompare(left.lastUsedAt || "")), [personalFoods]);
  const localMatches = useMemo<LocalSearchResult[]>(() => {
    if (!normalizedQuery) return [];
    const results: Array<LocalSearchResult & { score: number }> = [];
    recipes.forEach((recipe) => {
      const searchable = `${recipe.name} ${recipe.ingredients.map((ingredient) => ingredient.name).join(" ")}`;
      if (searchable.toLocaleLowerCase().includes(normalizedQuery)) results.push({ kind: "recipe", item: recipe, score: matchScore(recipe.name, normalizedQuery, 18) });
    });
    personalFoods.forEach((food) => {
      const searchable = `${food.name} ${food.brand || ""} ${food.barcode || ""}`;
      if (searchable.toLocaleLowerCase().includes(normalizedQuery)) {
        const usedBoost = diaryFoodIds.has(food.id) ? 24 : 0;
        const customBoost = food.source === "custom" ? 20 : 0;
        results.push({ kind: "food", item: food, score: matchScore(food.name, normalizedQuery, usedBoost + customBoost) + Number(food.lastUsedAt ? 1 : 0) });
      }
    });
    foods.filter((food) => food.source === "seed").forEach((food) => {
      if (`${food.name} ${food.brand || ""}`.toLocaleLowerCase().includes(normalizedQuery)) results.push({ kind: "food", item: food, score: matchScore(food.name, normalizedQuery) });
    });
    return results.sort((left, right) => right.score - left.score).map((result): LocalSearchResult => result.kind === "food" ? { kind: "food", item: result.item } : { kind: "recipe", item: result.item });
  }, [diaryFoodIds, foods, normalizedQuery, personalFoods, recipes]);
  const runRemoteSearch = useCallback(async (value: string) => {
    const requestId = ++searchRequestRef.current;
    const normalized = value.trim();
    if (normalized.length < 2) { setRemoteResults([]); setLoading(false); setSearchError(""); return; }
    setLoading(true); setSearchError(""); setRemoteResults([]);
    try {
      const results = await searchOpenFoodFacts(normalized);
      if (requestId !== searchRequestRef.current) return;
      const localIds = new Set(foods.map((food) => food.id));
      setRemoteResults(results.filter((food) => !localIds.has(food.id)).slice(0, 20));
    } catch {
      if (requestId === searchRequestRef.current) { setRemoteResults([]); setSearchError("Online results are unavailable. Your saved matches are still available."); }
    } finally {
      if (requestId === searchRequestRef.current) setLoading(false);
    }
  }, [foods]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void runRemoteSearch(query); }, 500);
    return () => window.clearTimeout(timer);
  }, [query, runRemoteSearch]);
  const showResults = Boolean(normalizedQuery);
  const noResults = showResults && !localMatches.length && !remoteResults.length && !loading;
  const defaultLibrary = <><section className="food-library" aria-labelledby="recipes-heading"><div className="section-heading"><div><span className="eyebrow">Made once, ready again</span><h2 id="recipes-heading">Your recipes</h2></div><span className="subtle">{recipes.length} saved</span></div>{recipes.length ? <div className="food-list card">{recipes.map((recipe) => <RecipeRow key={recipe.id} recipe={recipe} hideCalories={hideCalories} onSelect={() => onSelectRecipe(recipe)} />)}</div> : <div className="empty-state card"><span className="action-icon mint"><BookOpen size={22} /></span><strong>Your saved recipes will appear here.</strong><p>Save a meal from Today and it will be ready to log here.</p></div>}</section><details className="saved-foods-disclosure card" open><summary><span className="saved-foods-copy"><span className="eyebrow">Your shelf</span><strong>Your foods</strong><small>{savedFoods.length} saved item{savedFoods.length === 1 ? "" : "s"}</small></span><ChevronDown size={18} aria-hidden="true" /></summary>{savedFoods.length ? <div className="food-list saved-food-list">{savedFoods.map((food) => <FoodRow key={food.id} food={food} hideCalories={hideCalories} onSelect={() => onSelect(food)} />)}</div> : <div className="empty-state"><strong>Your saved foods will appear here.</strong><p>Save a custom or packaged food and it will be ready to use here.</p></div>}</details></>;
  return <main className="page discover-page"><header className="page-header"><span className="eyebrow">Food library</span><h1>Find or add food</h1><p>Search your saved foods, recipes, and the food database in one place.</p></header><label className="library-search"><Search size={18} aria-hidden="true" /><span className="visually-hidden">Search foods and recipes</span><ClearableInput autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onClear={() => setQuery("")} placeholder="Search foods and recipes" type="search" clearLabel="Clear food library search" /></label>{showResults && <div className="library-search-hint">Your saved foods and recipes appear first. Online matches follow when available.</div>}<div className="discover-actions"><button type="button" className="secondary-button" onClick={() => onAdd("scan")}><ScanLine size={17} />Scan barcode</button><button type="button" className="secondary-button" onClick={() => onAdd("manual")}><Plus size={17} />Add custom</button><button type="button" className="secondary-button" onClick={() => onAdd("quick")}><Plus size={17} />Quick add</button><button type="button" className="secondary-button" onClick={() => onAdd("label")}><ImagePlus size={17} />Scan label</button></div>{showResults ? <div className="search-result-groups">{localMatches.length > 0 && <section className="search-result-group" aria-label="Your matches"><div className="quick-list-heading"><strong>Your matches</strong><span>Saved, personal, and previously selected</span></div><div className="food-list card">{localMatches.map((result) => result.kind === "food" ? <FoodRow key={`food-${result.item.id}`} food={result.item} hideCalories={hideCalories} onSelect={() => onSelect(result.item)} /> : <RecipeRow key={`recipe-${result.item.id}`} recipe={result.item} hideCalories={hideCalories} onSelect={() => onSelectRecipe(result.item)} />)}</div></section>}{(remoteResults.length > 0 || loading) && <section className="search-result-group" aria-label="Online matches"><div className="quick-list-heading"><strong>Online matches</strong><span>Open Food Facts and other catalogue sources</span></div>{loading && <div className="search-status" role="status"><i />Searching the online catalogue…</div>}{remoteResults.length > 0 && <div className="food-list card">{remoteResults.map((food) => <FoodRow key={food.id} food={food} hideCalories={hideCalories} onSelect={() => onSelect(food)} />)}</div>}</section>}{searchError && <div className="inline-alert" role="alert"><WifiOff size={17} />{searchError}</div>}{noResults && <div className="search-empty card"><Search /><strong>No match yet</strong><p>Try another name or add it as a custom food for next time.</p><button className="secondary-button" type="button" onClick={() => onAdd("manual")}>Add custom food</button></div>}</div> : <>{!repeat.length ? null : <section className="food-library" aria-labelledby="repeat-items-heading"><div className="section-heading"><div><span className="eyebrow">Repeat without searching</span><h2 id="repeat-items-heading">Most picked</h2></div><span className="subtle">Based on your diary</span></div><div className="food-list card">{repeat.map((entry: RepeatItem) => entry.kind === "food" ? <FoodRow key={`food-${entry.item.id}`} food={entry.item} hideCalories={hideCalories} onSelect={() => onSelect(entry.item)} /> : <RecipeRow key={`recipe-${entry.item.id}`} recipe={entry.item} hideCalories={hideCalories} onSelect={() => onSelectRecipe(entry.item)} />)}</div></section>}{defaultLibrary}</>}</main>;
}
