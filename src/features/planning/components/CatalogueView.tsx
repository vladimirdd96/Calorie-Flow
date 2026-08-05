"use client";

import { BookOpen, ChefHat, ChefHat as CookIcon, ChevronLeft, ChevronRight, ListPlus, RefreshCw, Search, Sparkles, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { catalogueBrowseRows, featuredCatalogueRecipe } from "../cataloguePresentation";
import { cuisines, dietaryTags, recipeCookViews } from "@/lib/types";
import type { DietaryTag, Meal, MealPlanEntry, MealType, PublicRecipe, Recipe, RecipeCookView } from "@/lib/types";

const LAST_GENERATED_SETTING = "plan:lastRecipeGenAt";
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
type SourceFilter = "all" | "community" | "ai";

async function authToken() {
  return (await getSupabase()?.auth.getSession())?.data.session?.access_token;
}

function RecipeBrowseCard({ item, hideCalories, onOpen, featured = false }: { item: PublicRecipe; hideCalories?: boolean; onOpen: () => void; featured?: boolean }) {
  return <button type="button" className={featured ? "catalogue-feature-card" : "recipe-browse-card"} onClick={onOpen}>
    {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span className="recipe-tile-icon">{item.source === "ai" ? <Sparkles size={22} /> : <ChefHat size={22} />}</span>}
    <span className="recipe-browse-card-overlay">
      {featured && <small className="catalogue-feature-kicker">Tonight&apos;s pick</small>}
      <strong>{item.name}</strong>
      <small>{item.source === "ai" ? "AI pick" : "Community"}{!hideCalories && ` · ${Math.round(item.nutritionPerServing.calories)} kcal`}</small>
    </span>
  </button>;
}

function CatalogueRow({ title, items, hideCalories, onOpen }: { title: string; items: PublicRecipe[]; hideCalories?: boolean; onOpen: (item: PublicRecipe) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const updateControls = () => {
      const maximum = track.scrollWidth - track.clientWidth;
      setCanScrollBack(track.scrollLeft > 2);
      setCanScrollForward(maximum > 2 && track.scrollLeft < maximum - 2);
    };
    const observer = new ResizeObserver(updateControls);
    observer.observe(track);
    track.addEventListener("scroll", updateControls, { passive: true });
    updateControls();
    return () => { observer.disconnect(); track.removeEventListener("scroll", updateControls); };
  }, [items.length]);

  const scroll = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * Math.max(280, track.clientWidth * .82), behavior: "smooth" });
  };

  return <section className="catalogue-row">
    <h3>{title}</h3>
    <div ref={trackRef} className="catalogue-row-track">{items.map((item) => <RecipeBrowseCard key={item.id} item={item} hideCalories={hideCalories} onOpen={() => onOpen(item)} />)}</div>
    {canScrollBack && <button type="button" className="catalogue-row-control previous" aria-label={`Show earlier recipes in ${title}`} onClick={() => scroll(-1)}><ChevronLeft /></button>}
    {canScrollForward && <button type="button" className="catalogue-row-control next" aria-label={`Show more recipes in ${title}`} onClick={() => scroll(1)}><ChevronRight /></button>}
  </section>;
}

export function CatalogueView({ userId, meals, recipes, entries, hideCalories, cookView, onSaveToLibrary, onPlanRecipe, onAddToShopping }: {
  userId?: string;
  meals: Meal[];
  recipes: Recipe[];
  entries: MealPlanEntry[];
  hideCalories?: boolean;
  cookView?: RecipeCookView;
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

  const openRecipe = (item: PublicRecipe) => {
    setSelected(item); setServingsCount(item.servings); setCheckedSteps(new Set()); onSaveToLibrary(item);
    if (cookView === recipeCookViews.step && item.instructions.length) setCooking(true);
  };
  const toggleDietary = (tag: DietaryTag) => setDietary((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  const toggleStep = (index: number) => setCheckedSteps((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next; });
  const filtersActive = Boolean(query.trim() || source !== "all" || cuisine || dietary.length > 0);

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
      fetchCatalogue({ q: query, source, cuisine: cuisine || undefined, dietary: dietary.length ? dietary : undefined }).then((results) => { if (active) setCatalogue(results); })
        .catch(() => { if (active) setError("Couldn't load the catalogue right now."); })
        .finally(() => { if (active) setLoading(false); });
    };
    const timeout = setTimeout(load, query ? 350 : 0);
    return () => { active = false; clearTimeout(timeout); };
  }, [query, source, cuisine, dietary]);

  const savedPublicIds = useMemo(() => new Set(recipes.map((item) => item.publicRecipeId).filter(Boolean)), [recipes]);

  const featured = useMemo(() => filtersActive ? undefined : featuredCatalogueRecipe(catalogue), [catalogue, filtersActive]);
  const rows = useMemo(() => filtersActive ? [] : catalogueBrowseRows(catalogue, featured?.id), [catalogue, featured?.id, filtersActive]);

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

  const scaleFactor = selected ? servingsCount / selected.servings : 1;

  return <section id="plan-catalogue-panel" role="tabpanel" aria-labelledby="plan-catalogue-tab" className="catalogue-view workspace-panel">
    <label className="library-search"><Search size={16} aria-hidden="true" /><span className="visually-hidden">Search the catalogue</span><ClearableInput value={query} onChange={(event) => setQuery(event.target.value)} onClear={() => setQuery("")} placeholder="Search the catalogue" type="search" clearLabel="Clear catalogue search" /></label>
    <div className="library-filters" role="group" aria-label="Catalogue source">
      <button type="button" className={source === "all" ? "active" : ""} onClick={() => setSource("all")}>All</button>
      <button type="button" className={source === "community" ? "active" : ""} onClick={() => setSource("community")}><Users size={13} />Community</button>
      <button type="button" className={source === "ai" ? "active" : ""} onClick={() => setSource("ai")}><Sparkles size={13} />AI picks</button>
    </div>
    <div className="library-filter-wrap"><div className="library-filters" role="group" aria-label="Cuisine">
      <button type="button" className={cuisine === "" ? "active" : ""} onClick={() => setCuisine("")}>All cuisines</button>
      {Object.values(cuisines).map((value) => <button key={value} type="button" className={cuisine === value ? "active" : ""} onClick={() => setCuisine(cuisine === value ? "" : value)}>{humanizeTaxonomyKey(value)}</button>)}
    </div></div>
    <div className="library-filter-wrap"><div className="library-filters" role="group" aria-label="Dietary preference">
      {Object.values(dietaryTags).map((value) => <button key={value} type="button" className={dietary.includes(value) ? "active" : ""} onClick={() => toggleDietary(value)}>{humanizeTaxonomyKey(value)}</button>)}
    </div></div>
    {userId && <div className="catalogue-refresh">
      <button type="button" className="secondary-button" onClick={() => void refresh()} disabled={refreshing || cooldownDaysLeft > 0}>
        <RefreshCw size={15} className={refreshing ? "spin" : ""} />{refreshing ? "Refreshing…" : cooldownDaysLeft > 0 ? `Next refresh in ${cooldownDaysLeft}d` : "Refresh my picks"}
      </button>
      {refreshNote && <small>{refreshNote}</small>}
    </div>}
    {error && <div className="inline-alert error" role="alert">{error}</div>}
    {loading ? <div className="catalogue-loading" role="status" aria-label="Loading recipes"><div className="catalogue-skeleton-feature" />{Array.from({ length: 5 }, (_, index) => <i key={index} className="catalogue-skeleton-card" />)}</div>
      : !error && !catalogue.length ? <div className="recipe-empty catalogue-empty card"><span className="action-icon mint"><ChefHat size={22} /></span><strong>The catalogue is still filling up.</strong><p>Share one of your recipes, or refresh your picks to add AI-assisted ideas.</p></div>
      : filtersActive
        ? <div className="catalogue-grid">{catalogue.map((item) => <RecipeBrowseCard key={item.id} item={item} hideCalories={hideCalories} onOpen={() => openRecipe(item)} />)}</div>
        : <div className="catalogue-rows">{featured && <RecipeBrowseCard item={featured} featured hideCalories={hideCalories} onOpen={() => openRecipe(featured)} />}{rows.map((row) => <CatalogueRow key={row.title} title={row.title} items={row.items} hideCalories={hideCalories} onOpen={openRecipe} />)}</div>}

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
          { key: "shopping", label: "Add to shopping list", icon: ListPlus, onClick: () => onAddToShopping(selected.ingredients.map((ingredient) => ingredient.name)) },
          { key: "plan", label: "Plan this", icon: BookOpen, onClick: () => setPlanTarget(selected), variant: "secondary" },
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
