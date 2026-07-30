"use client";
/* eslint-disable @next/next/no-img-element -- product thumbnails are dynamic user content. */

import { ArrowLeft, BookOpen, ChevronRight, Plus, Search, WifiOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AddFoodView } from "@/features/food-capture/types";
import { ClearableInput } from "@/features/shared/ClearableInput";
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
type FoodFilter = "all" | "custom" | "reference";

function matchScore(value: string, query: string, boost = 0) {
  const normalized = value.toLocaleLowerCase();
  if (normalized === query) return 100 + boost;
  if (normalized.startsWith(query)) return 80 + boost;
  if (normalized.split(/\s+/).some((word) => word.startsWith(query))) return 65 + boost;
  return 40 + boost;
}

export function DiscoverView({ foods, recipes, meals, onSelect, onSelectRecipe, onAdd, hideCalories, onBack }: { foods: Food[]; recipes: Recipe[]; meals: Meal[]; onSelect: (food: Food) => void; onSelectRecipe: (recipe: Recipe) => void; onAdd: (view: AddFoodView) => void; hideCalories: boolean; onBack: () => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FoodFilter>("all");
  const [remoteResults, setRemoteResults] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const searchRequestRef = useRef(0);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const diaryFoodIds = useMemo(() => new Set(meals.map((meal) => meal.foodId).filter((id): id is string => Boolean(id))), [meals]);
  const localMatches = useMemo<LocalSearchResult[]>(() => {
    if (!normalizedQuery) return [];
    const results: Array<LocalSearchResult & { score: number }> = [];
    recipes.forEach((recipe) => {
      const searchable = `${recipe.name} ${recipe.ingredients.map((ingredient) => ingredient.name).join(" ")}`;
      if (searchable.toLocaleLowerCase().includes(normalizedQuery)) results.push({ kind: "recipe", item: recipe, score: matchScore(recipe.name, normalizedQuery, 18) });
    });
    foods.forEach((food) => {
      const searchable = `${food.name} ${food.brand || ""} ${food.barcode || ""}`;
      if (searchable.toLocaleLowerCase().includes(normalizedQuery)) results.push({ kind: "food", item: food, score: matchScore(food.name, normalizedQuery, diaryFoodIds.has(food.id) ? 24 : 0) });
    });
    return results.sort((left, right) => right.score - left.score).map((result): LocalSearchResult => result.kind === "food" ? { kind: "food", item: result.item } : { kind: "recipe", item: result.item });
  }, [diaryFoodIds, foods, normalizedQuery, recipes]);
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
      if (requestId === searchRequestRef.current) setSearchError("Online results are unavailable. Your saved matches are still available.");
    } finally {
      if (requestId === searchRequestRef.current) setLoading(false);
    }
  }, [foods]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void runRemoteSearch(query); }, 500);
    return () => window.clearTimeout(timer);
  }, [query, runRemoteSearch]);
  const showResults = Boolean(normalizedQuery);
  const visibleFoods = foods.filter((food) => filter === "all" || (filter === "custom" ? food.source !== "seed" : food.source === "seed"));
  const noResults = showResults && !localMatches.length && !remoteResults.length && !loading;
  return <main className="page discover-page food-library-page">
    <header className="library-handoff-header"><div><span>Library</span><h1>Your foods</h1></div><button type="button" className="library-back-button" onClick={onBack}><ArrowLeft size={16} />Back to plan</button></header>
    <label className="library-search"><Search size={16} aria-hidden="true" /><span className="visually-hidden">Search your foods</span><ClearableInput value={query} onChange={(event) => setQuery(event.target.value)} onClear={() => setQuery("")} placeholder="Search your foods" type="search" clearLabel="Clear food library search" /></label>
    {!showResults && <div className="library-filter-wrap"><div className="library-filters" role="group" aria-label="Food filters">{([{ key: "all", label: "All" }, { key: "custom", label: "Your foods" }, { key: "reference", label: "Reference" }] as const).map((item) => <button key={item.key} type="button" className={filter === item.key ? "active" : ""} onClick={() => setFilter(item.key)}>{item.label}</button>)}</div></div>}
    {showResults ? <div className="search-result-groups">
      {localMatches.length > 0 && <section className="search-result-group" aria-label="Your matches"><div className="quick-list-heading"><strong>Your matches</strong><span>Saved first</span></div><div className="food-list library-result-card">{localMatches.map((result) => result.kind === "food" ? <FoodRow key={`food-${result.item.id}`} food={result.item} hideCalories={hideCalories} onSelect={() => onSelect(result.item)} /> : <RecipeRow key={`recipe-${result.item.id}`} recipe={result.item} hideCalories={hideCalories} onSelect={() => onSelectRecipe(result.item)} />)}</div></section>}
      {(remoteResults.length > 0 || loading) && <section className="search-result-group" aria-label="Online matches"><div className="quick-list-heading"><strong>Search results</strong><span>Open Food Facts</span></div>{loading && <div className="search-status" role="status"><i />Searching…</div>}{remoteResults.length > 0 && <div className="food-list library-result-card">{remoteResults.map((food) => <FoodRow key={food.id} food={food} hideCalories={hideCalories} onSelect={() => onSelect(food)} />)}</div>}</section>}
      {searchError && <div className="inline-alert" role="alert"><WifiOff size={17} />{searchError}</div>}
      {noResults && <div className="search-empty"><Search /><strong>No foods found</strong><p>Try another search or add a custom food.</p><button className="primary-button" type="button" onClick={() => onAdd("manual")}><Plus size={14} />Add food</button></div>}
    </div> : visibleFoods.length ? <div className="food-list library-result-card">{visibleFoods.map((food) => <FoodRow key={food.id} food={food} hideCalories={hideCalories} onSelect={() => onSelect(food)} />)}</div> : <div className="search-empty"><BookOpen /><strong>No foods yet</strong><p>Foods you log or add get saved here.</p><button className="primary-button" type="button" onClick={() => onAdd("manual")}><Plus size={14} />Add food</button></div>}
  </main>;
}
