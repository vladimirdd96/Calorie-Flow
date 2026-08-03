"use client";

import { BookOpen, ChefHat, RefreshCw, Search, Sparkles, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Sheet } from "@/features/shared/Sheet";
import { ClearableInput } from "@/features/shared/ClearableInput";
import { QuickPlanSheet } from "./QuickPlanSheet";
import { getSetting, setSetting } from "@/lib/db";
import { fetchCatalogue } from "@/lib/cloud";
import { getSupabase } from "@/lib/supabase";
import { localDateKey } from "@/lib/nutrition";
import { topEatenFoods } from "@/lib/planning";
import type { Meal, MealPlanEntry, MealType, PublicRecipe, Recipe } from "@/lib/types";

const LAST_GENERATED_SETTING = "plan:lastRecipeGenAt";
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
type SourceFilter = "all" | "community" | "ai";

async function authToken() {
  return (await getSupabase()?.auth.getSession())?.data.session?.access_token;
}

function CatalogueTile({ item, hideCalories, onOpen }: { item: PublicRecipe; hideCalories?: boolean; onOpen: () => void }) {
  return <button type="button" className="recipe-tile" onClick={onOpen}>
    {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span className="recipe-tile-icon">{item.source === "ai" ? <Sparkles size={22} /> : <ChefHat size={22} />}</span>}
    <span className="recipe-tile-body">
      <strong>{item.name}</strong>
      <small>{item.source === "ai" ? "AI pick" : "Community"}{!hideCalories && ` · ${Math.round(item.nutritionPerServing.calories)} kcal`}</small>
    </span>
  </button>;
}

export function CatalogueView({ userId, meals, recipes, entries, hideCalories, onSaveToLibrary, onPlanRecipe }: {
  userId?: string;
  meals: Meal[];
  recipes: Recipe[];
  entries: MealPlanEntry[];
  hideCalories?: boolean;
  onSaveToLibrary: (item: PublicRecipe) => Recipe;
  onPlanRecipe: (recipe: Recipe, date: string, mealType: MealType) => void;
}) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [catalogue, setCatalogue] = useState<PublicRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState("");
  const [cooldownDaysLeft, setCooldownDaysLeft] = useState(0);
  const [selected, setSelected] = useState<PublicRecipe>();
  const [planTarget, setPlanTarget] = useState<PublicRecipe>();

  useEffect(() => {
    getSetting<string>(LAST_GENERATED_SETTING).then((stored) => {
      if (!stored) return;
      const remaining = new Date(stored).getTime() + COOLDOWN_MS - Date.now();
      if (remaining > 0) setCooldownDaysLeft(Math.ceil(remaining / (24 * 60 * 60 * 1000)));
    });
  }, []);

  useEffect(() => {
    let active = true;
    const load = () => {
      setLoading(true); setError("");
      fetchCatalogue({ q: query, source }).then((results) => { if (active) setCatalogue(results); })
        .catch(() => { if (active) setError("Couldn't load the catalogue right now."); })
        .finally(() => { if (active) setLoading(false); });
    };
    const timeout = setTimeout(load, query ? 350 : 0);
    return () => { active = false; clearTimeout(timeout); };
  }, [query, source]);

  const savedPublicIds = useMemo(() => new Set(recipes.map((item) => item.publicRecipeId).filter(Boolean)), [recipes]);

  const refresh = async () => {
    if (!userId) return;
    setRefreshing(true); setRefreshNote("");
    try {
      const token = await authToken();
      const response = await fetch("/api/recipes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ topFoods: topEatenFoods(meals) }),
      });
      const body = await response.json();
      if (response.status === 429) {
        setRefreshNote(body.error || "You can refresh your picks once every 7 days.");
        setCooldownDaysLeft(Math.max(1, Math.ceil((body.retryAfterSeconds || 0) / (24 * 60 * 60))));
        return;
      }
      if (!response.ok) throw new Error(body.error || "Couldn't refresh your picks right now.");
      const added = Array.isArray(body.recipes) ? body.recipes as PublicRecipe[] : [];
      if (added.length) setCatalogue((current) => [...added.filter((item) => !current.some((existing) => existing.id === item.id)), ...current]);
      setRefreshNote(added.length ? `Added ${added.length} new pick${added.length === 1 ? "" : "s"} to the catalogue.` : "No new picks this time — check back after you've logged a few more meals.");
      void setSetting(LAST_GENERATED_SETTING, new Date().toISOString());
      setCooldownDaysLeft(7);
    } catch (caught) {
      setRefreshNote(caught instanceof Error ? caught.message : "Couldn't refresh your picks right now.");
    } finally { setRefreshing(false); }
  };

  return <section id="plan-catalogue-panel" role="tabpanel" aria-labelledby="plan-catalogue-tab" className="catalogue-view workspace-panel">
    <label className="library-search"><Search size={16} aria-hidden="true" /><span className="visually-hidden">Search the catalogue</span><ClearableInput value={query} onChange={(event) => setQuery(event.target.value)} onClear={() => setQuery("")} placeholder="Search the catalogue" type="search" clearLabel="Clear catalogue search" /></label>
    <div className="library-filters" role="group" aria-label="Catalogue source">
      <button type="button" className={source === "all" ? "active" : ""} onClick={() => setSource("all")}>All</button>
      <button type="button" className={source === "community" ? "active" : ""} onClick={() => setSource("community")}><Users size={13} />Community</button>
      <button type="button" className={source === "ai" ? "active" : ""} onClick={() => setSource("ai")}><Sparkles size={13} />AI picks</button>
    </div>
    {userId && <div className="catalogue-refresh">
      <button type="button" className="secondary-button" onClick={() => void refresh()} disabled={refreshing || cooldownDaysLeft > 0}>
        <RefreshCw size={15} className={refreshing ? "spin" : ""} />{refreshing ? "Refreshing…" : cooldownDaysLeft > 0 ? `Next refresh in ${cooldownDaysLeft}d` : "Refresh my picks"}
      </button>
      {refreshNote && <small>{refreshNote}</small>}
    </div>}
    {error && <div className="inline-alert error" role="alert">{error}</div>}
    {!loading && !error && !catalogue.length ? <div className="recipe-empty card"><span className="action-icon mint"><ChefHat size={22} /></span><strong>The catalogue is still filling up.</strong><p>Share one of your recipes, or refresh your picks to add AI-assisted ideas.</p></div>
      : <div className="catalogue-grid">{catalogue.map((item) => <CatalogueTile key={item.id} item={item} hideCalories={hideCalories} onOpen={() => setSelected(item)} />)}</div>}

    {selected && <Sheet onClose={() => setSelected(undefined)} wide label={selected.name}>
      <div className="catalogue-detail">
        {selected.imageUrl && <div className="catalogue-detail-photo"><img src={selected.imageUrl} alt="" />{selected.imageCredit && <a href={selected.imageCredit.sourceUrl} target="_blank" rel="noopener noreferrer">via {selected.imageCredit.label} ↗</a>}</div>}
        <div className="sheet-header"><div><span className="eyebrow">{selected.source === "ai" ? "AI pick" : "Community recipe"}</span><h2>{selected.name}</h2></div><span /></div>
        <p className="catalogue-detail-meta">{selected.servings} {selected.servings === 1 ? "serving" : "servings"} · {Math.round(selected.nutritionPerServing.calories)} kcal per serving</p>
        <ul className="catalogue-detail-ingredients">{selected.ingredients.map((ingredient) => <li key={ingredient.id}>{ingredient.name}</li>)}</ul>
        <div className="sheet-actions">
          <button type="button" className="secondary-button" disabled={savedPublicIds.has(selected.id)} onClick={() => onSaveToLibrary(selected)}><BookOpen size={16} />{savedPublicIds.has(selected.id) ? "Saved" : "Save to my recipes"}</button>
          <button type="button" className="primary-button" onClick={() => setPlanTarget(selected)}>Plan this</button>
        </div>
      </div>
    </Sheet>}

    {planTarget && <Sheet onClose={() => setPlanTarget(undefined)} label={`Plan ${planTarget.name}`}>
      <QuickPlanSheet entries={entries} initialDate={localDateKey()} itemName={planTarget.name} onConfirm={(date, mealType) => { onPlanRecipe(onSaveToLibrary(planTarget), date, mealType); setPlanTarget(undefined); setSelected(undefined); }} />
    </Sheet>}
  </section>;
}
