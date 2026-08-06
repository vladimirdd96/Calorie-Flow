"use client";

import { BookOpen, ChefHat, ChefHat as CookIcon, ListPlus, RefreshCw, Search, SlidersHorizontal, Sparkles, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Sheet } from "@/features/shared/Sheet";
import { ClearableInput } from "@/features/shared/ClearableInput";
import { QuickPlanSheet } from "./QuickPlanSheet";
import { RecipeDetail } from "./RecipeDetail";
import { CookMode } from "./CookMode";
import { getSetting, setSetting } from "@/lib/db";
import { fetchCatalogue } from "@/lib/cloud";
import { getSupabase } from "@/lib/supabase";
import { localDateKey } from "@/lib/nutrition";
import { humanizeTaxonomyKey, topEatenFoods } from "@/lib/planning";
import { CatalogueRails } from "./CatalogueRails";
import { RecipeBrowseCard } from "./CatalogueRow";
import { cuisines, dietaryTags, recipeCookViews } from "@/lib/types";
import type { DietaryTag, Meal, MealPlanEntry, MealType, PublicRecipe, Recipe, RecipeCookView } from "@/lib/types";

const LAST_GENERATED_SETTING = "plan:lastRecipeGenAt";
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
type SourceFilter = "all" | "community" | "ai";

async function authToken() {
  return (await getSupabase()?.auth.getSession())?.data.session?.access_token;
}

export function CatalogueView({ userId, meals, recipes, entries, hideCalories, cookView, planEnabled, onSaveToLibrary, onPlanRecipe, onAddToShopping }: {
  userId?: string;
  meals: Meal[];
  recipes: Recipe[];
  entries: MealPlanEntry[];
  hideCalories?: boolean;
  cookView?: RecipeCookView;
  planEnabled: boolean;
  onSaveToLibrary: (item: PublicRecipe) => Recipe;
  onPlanRecipe: (recipe: Recipe, date: string, mealType: MealType) => void;
  onAddToShopping: (names: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [cuisine, setCuisine] = useState<string>("");
  const [dietary, setDietary] = useState<DietaryTag[]>([]);
  const [catalogue, setCatalogue] = useState<PublicRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState("");
  const [cooldownDaysLeft, setCooldownDaysLeft] = useState(0);
  const [selected, setSelected] = useState<PublicRecipe>();
  const [planTarget, setPlanTarget] = useState<PublicRecipe>();
  const [servingsCount, setServingsCount] = useState(1);
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());
  const [cooking, setCooking] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [generated, setGenerated] = useState<PublicRecipe[]>([]);

  const openRecipe = (item: PublicRecipe) => {
    setSelected(item); setServingsCount(item.servings); setCheckedSteps(new Set()); onSaveToLibrary(item);
    if (cookView === recipeCookViews.step && item.instructions.length) setCooking(true);
  };
  const toggleDietary = (tag: DietaryTag) => setDietary((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  const toggleStep = (index: number) => setCheckedSteps((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next; });
  const filtersActive = Boolean(query.trim() || source !== "all" || cuisine || dietary.length > 0);
  const activeFilterCount = (source !== "all" ? 1 : 0) + (cuisine ? 1 : 0) + dietary.length;

  useEffect(() => {
    getSetting<string>(LAST_GENERATED_SETTING).then((stored) => {
      if (!stored) return;
      const remaining = new Date(stored).getTime() + COOLDOWN_MS - Date.now();
      if (remaining > 0) setCooldownDaysLeft(Math.ceil(remaining / (24 * 60 * 60 * 1000)));
    });
  }, []);

  // Filtered browsing is a flat search over the whole catalogue; unfiltered browsing is the lazy rails below.
  useEffect(() => {
    if (!filtersActive) return;
    let active = true;
    const load = () => {
      setLoading(true); setError("");
      fetchCatalogue({ q: query, source, cuisine: cuisine || undefined, dietary: dietary.length ? dietary : undefined }).then((results) => { if (active) setCatalogue(results); })
        .catch(() => { if (active) setError("Couldn't load the catalogue right now."); })
        .finally(() => { if (active) setLoading(false); });
    };
    const timeout = setTimeout(load, query ? 350 : 0);
    return () => { active = false; clearTimeout(timeout); };
  }, [query, source, cuisine, dietary, filtersActive]);

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
      if (added.length) setGenerated((current) => [...added.filter((item) => !current.some((existing) => existing.id === item.id)), ...current]);
      setRefreshNote(added.length ? `Added ${added.length} new pick${added.length === 1 ? "" : "s"} to the catalogue.` : "No new picks this time — check back after you've logged a few more meals.");
      void setSetting(LAST_GENERATED_SETTING, new Date().toISOString());
      setCooldownDaysLeft(7);
    } catch (caught) {
      setRefreshNote(caught instanceof Error ? caught.message : "Couldn't refresh your picks right now.");
    } finally { setRefreshing(false); }
  };

  const scaleFactor = selected ? servingsCount / selected.servings : 1;
  const refreshCta = refreshing ? "Refreshing your picks…" : cooldownDaysLeft > 0 ? `Next refresh in ${cooldownDaysLeft}d` : "Refresh my picks";

  return <section id="plan-catalogue-panel" role="tabpanel" aria-labelledby="plan-catalogue-tab" className="catalogue-view workspace-panel">
    <div className="catalogue-search-row">
      <label className="library-search"><Search size={16} aria-hidden="true" /><span className="visually-hidden">Search the catalogue</span><ClearableInput value={query} onChange={(event) => setQuery(event.target.value)} onClear={() => setQuery("")} placeholder="Search recipes" type="search" clearLabel="Clear catalogue search" /></label>
      {userId && <button
        type="button"
        className="catalogue-refresh-trigger"
        onClick={() => void refresh()}
        disabled={refreshing || cooldownDaysLeft > 0}
        title={refreshCta}
        aria-label={refreshCta}
      ><RefreshCw size={16} className={refreshing ? "spin" : ""} /></button>}
      <button type="button" className={`catalogue-filters-trigger${activeFilterCount ? " active" : ""}`} onClick={() => setFiltersOpen(true)}>
        <SlidersHorizontal size={15} /><span className="catalogue-filters-label">Filters</span>{activeFilterCount > 0 && <span className="catalogue-filters-count">{activeFilterCount}</span>}
      </button>
    </div>
    {refreshNote && <p className="catalogue-refresh-note" role="status">{refreshNote}</p>}
    {!filtersActive ? <CatalogueRails generated={generated} hideCalories={hideCalories} onOpen={openRecipe} />
      : error ? <div className="inline-alert error" role="alert">{error}</div>
      : loading ? <div className="catalogue-loading" role="status" aria-label="Loading recipes">{Array.from({ length: 6 }, (_, index) => <i key={index} className="catalogue-skeleton-card" />)}</div>
      : !catalogue.length ? <div className="recipe-empty catalogue-empty card"><span className="action-icon mint"><ChefHat size={22} /></span><strong>No recipes match those filters.</strong><p>Try a different cuisine, or clear the filters to browse everything.</p></div>
      : <div className="catalogue-grid">{catalogue.map((item) => <RecipeBrowseCard key={item.id} item={item} hideCalories={hideCalories} onOpen={() => openRecipe(item)} />)}</div>}

    {filtersOpen && <Sheet onClose={() => setFiltersOpen(false)} label="Filter the catalogue">
      <div className="catalogue-filters-sheet">
        <div>
          <h4>Source</h4>
          <div className="library-filters" role="group" aria-label="Catalogue source">
            <button type="button" className={source === "all" ? "active" : ""} onClick={() => setSource("all")}>All</button>
            <button type="button" className={source === "community" ? "active" : ""} onClick={() => setSource("community")}><Users size={13} />Community</button>
            <button type="button" className={source === "ai" ? "active" : ""} onClick={() => setSource("ai")}><Sparkles size={13} />AI picks</button>
          </div>
        </div>
        <div>
          <h4>Cuisine</h4>
          <div className="library-filters catalogue-filters-wrap" role="group" aria-label="Cuisine">
            <button type="button" className={cuisine === "" ? "active" : ""} onClick={() => setCuisine("")}>All cuisines</button>
            {Object.values(cuisines).map((value) => <button key={value} type="button" className={cuisine === value ? "active" : ""} onClick={() => setCuisine(cuisine === value ? "" : value)}>{humanizeTaxonomyKey(value)}</button>)}
          </div>
        </div>
        <div>
          <h4>Dietary</h4>
          <div className="library-filters catalogue-filters-wrap" role="group" aria-label="Dietary preference">
            {Object.values(dietaryTags).map((value) => <button key={value} type="button" className={dietary.includes(value) ? "active" : ""} onClick={() => toggleDietary(value)}>{humanizeTaxonomyKey(value)}</button>)}
          </div>
        </div>
        {activeFilterCount > 0 && <button type="button" className="secondary-button" onClick={() => { setSource("all"); setCuisine(""); setDietary([]); }}>Clear filters</button>}
      </div>
    </Sheet>}

    {selected && <Sheet onClose={() => { setSelected(undefined); setCooking(false); }} wide label={selected.name}>
      <RecipeDetail
        name={selected.name}
        imageUrl={selected.imageUrl}
        imageCredit={selected.imageCredit}
        eyebrow={selected.source === "ai" ? "AI pick" : "Community recipe"}
        cuisine={selected.cuisine}
        dietaryTags={selected.dietaryTags}
        hideCalories={hideCalories}
        caloriesPerServing={selected.nutritionPerServing.calories}
        servingsCount={servingsCount}
        onServingsChange={setServingsCount}
        ingredients={selected.ingredients}
        scaleFactor={scaleFactor}
        instructions={selected.instructions}
        checkedSteps={checkedSteps}
        onToggleStep={toggleStep}
        actions={[
          ...(planEnabled ? [{ key: "shopping", label: "Add to shopping list", icon: ListPlus, onClick: () => onAddToShopping(selected.ingredients.map((ingredient) => ingredient.name)) }] : []),
          ...(planEnabled ? [{ key: "plan", label: "Plan this", icon: BookOpen, onClick: () => setPlanTarget(selected), variant: "secondary" as const }] : []),
          { key: "cook", label: "Start cooking", icon: CookIcon, onClick: () => setCooking(true), variant: "primary", disabled: !selected.instructions.length },
        ]}
      />
      {savedPublicIds.has(selected.id) && <p className="recipe-view-saved-note">Saved to your recipes — find it under Recipes.</p>}
    </Sheet>}

    {selected && cooking && <CookMode name={selected.name} ingredients={selected.ingredients} scaleFactor={scaleFactor} instructions={selected.instructions} onClose={() => setCooking(false)} />}

    {planTarget && <Sheet onClose={() => setPlanTarget(undefined)} label={`Plan ${planTarget.name}`}>
      <QuickPlanSheet entries={entries} initialDate={localDateKey()} itemName={planTarget.name} onConfirm={(date, mealType) => { onPlanRecipe(onSaveToLibrary(planTarget), date, mealType); setPlanTarget(undefined); setSelected(undefined); }} />
    </Sheet>}
  </section>;
}
