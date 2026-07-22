"use client";

import { ArrowLeft, BookOpen, Camera, ChevronRight, Database, Info, Mic, Package, Pencil, Plus, ScanLine, Search, Send, ShieldCheck, Upload, WifiOff } from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AddFoodView } from "@/features/food-capture/types";
import { localDateKey } from "@/lib/nutrition";
import { findByBarcode, searchOpenFoodFacts } from "@/lib/openfoodfacts";
import { normalizeVoiceFoodQuery } from "@/lib/voice";
import { getSupabase } from "@/lib/supabase";
import type { Food, Meal, MealPhotoAnalysis, MealType, Recipe } from "@/lib/types";
import { BarcodeScanner } from "./components/BarcodeScanner";
import { FoodRow, ManualFood, PortionSheet, QuickMacroSheet } from "./components/FoodEntrySheets";
import { LabelReader } from "./components/LabelReader";
import { MealPhotoReader } from "./components/MealPhotoReader";

type AddView = AddFoodView;

export function hideCalorieValues(content: string) { return content.replace(/\b\d[\d,.]*\s*(?:-|–|—)?\s*(?:kcal|calories?)\b/gi, "energy hidden"); }
export { PortionSheet } from "./components/FoodEntrySheets";

function RecipeSearchRow({ recipe, hideCalories, onSelect }: { recipe: Recipe; hideCalories: boolean; onSelect: () => void }) {
  return <button className="food-row recipe-row" type="button" onClick={onSelect}><span className="recipe-row-icon"><BookOpen size={18} /></span><span className="food-copy"><strong>{recipe.name}</strong><small>{recipe.ingredients.length} {recipe.ingredients.length === 1 ? "food" : "foods"} · your recipe</small></span>{!hideCalories && <span className="food-calories"><strong>{Math.round(recipe.nutritionPerServing.calories)}</strong><small>kcal total</small></span>}<ChevronRight size={18} /></button>;
}

function SearchResultGroup({ title, detail, empty, children }: { title: string; detail: string; empty: boolean; children: ReactNode }) {
  if (empty) return null;
  return <section className="search-result-group" aria-label={title}><div className="quick-list-heading"><strong>{title}</strong><span>{detail}</span></div>{children}</section>;
}

export function AddFoodSheet({ foods, meals, recipes, initialView = "start", initialMealType, onLog, onMealPhoto, onSaveFood, onSelectRecipe, onSelectFood, selectionOnly = false, hideCalories }: { foods: Food[]; meals: Meal[]; recipes: Recipe[]; initialView?: AddView; initialMealType?: MealType; onLog: (meal: Meal, food: Food) => void; onMealPhoto: (analysis: MealPhotoAnalysis) => void; onSaveFood: (food: Food) => Promise<void>; onSelectRecipe: (recipe: Recipe) => void; onSelectFood?: (food: Food) => void; selectionOnly?: boolean; hideCalories: boolean }) {
  const [view, setView] = useState<AddView>(initialView);
  const [selected, setSelected] = useState<Food>();
  const [questions, setQuestions] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [intakeError, setIntakeError] = useState("");
  const [manualNotice, setManualNotice] = useState("");
  const [unknownBarcode, setUnknownBarcode] = useState("");
  const [intakeDraft, setIntakeDraft] = useState("");
  const [coachReply, setCoachReply] = useState("");
  const [askingCoach, setAskingCoach] = useState(false);
  const [listening, setListening] = useState(false);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const searchRequestRef = useRef(0);
  const recent = [...foods].filter((food) => food.lastUsedAt).sort((a, b) => (b.lastUsedAt || "").localeCompare(a.lastUsedAt || "")).slice(0, 6);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const diaryFoodIds = useMemo(() => new Set(meals.map((meal) => meal.foodId).filter((id): id is string => Boolean(id))), [meals]);
  const matchingRecipes = useMemo(() => recipes.filter((recipe) => normalizedQuery && `${recipe.name} ${recipe.ingredients.map((ingredient) => ingredient.name).join(" ")}`.toLocaleLowerCase().includes(normalizedQuery)), [recipes, normalizedQuery]);
  const matchingDiaryRecipes = useMemo(() => {
    const savedRecipeIds = new Set(recipes.map((recipe) => recipe.id));
    const uniqueRecipes = new Map<string, Recipe>();
    meals.filter((meal) => meal.recipeId && !savedRecipeIds.has(meal.recipeId)).forEach((meal) => {
      const id = meal.recipeId || meal.id;
      if (!uniqueRecipes.has(id)) uniqueRecipes.set(id, { id, name: meal.name, servings: 1, ingredients: [], nutritionPerServing: meal.nutrition, createdAt: meal.createdAt, updatedAt: meal.createdAt });
    });
    return [...uniqueRecipes.values()].filter((recipe) => normalizedQuery && recipe.name.toLocaleLowerCase().includes(normalizedQuery));
  }, [meals, normalizedQuery, recipes]);
  const matchingPersonalFoods = useMemo(() => foods.filter((food) => normalizedQuery && food.source === "custom" && `${food.name} ${food.brand || ""} ${food.barcode || ""}`.toLocaleLowerCase().includes(normalizedQuery)), [foods, normalizedQuery]);
  const matchingDiaryFoods = useMemo(() => foods.filter((food) => normalizedQuery && food.source !== "custom" && diaryFoodIds.has(food.id) && `${food.name} ${food.brand || ""} ${food.barcode || ""}`.toLocaleLowerCase().includes(normalizedQuery)), [foods, diaryFoodIds, normalizedQuery]);
  const changeView = (nextView: AddView) => {
    if (view === "search" && nextView !== "search") {
      searchRequestRef.current += 1;
      setLoading(false);
      setSearchError("");
    }
    if (nextView !== "start") setIntakeError("");
    if (nextView !== "manual" && nextView !== "barcode-not-found") {
      setUnknownBarcode("");
      setManualNotice("");
    }
    setView(nextView);
  };
  const pick = (food: Food, followUps: string[] = []) => { setSearchError(""); if (selectionOnly) { onSelectFood?.(food); return; } setSelected(food); setQuestions(followUps); };
  const runSearch = useCallback(async (value: string) => {
    const requestId = ++searchRequestRef.current;
    const normalized = value.trim().toLowerCase();
    if (!normalized) { setRemoteResults([]); setSearchError(""); setLoading(false); return; }
    setRemoteResults([]); setLoading(true); setSearchError("");
    if (normalized.length < 2) { setLoading(false); return; }
    try {
      const remote = await searchOpenFoodFacts(value.trim());
      if (requestId !== searchRequestRef.current) return;
      const localIds = new Set(foods.map((food) => food.id));
      setRemoteResults(remote.filter((food) => !localIds.has(food.id)).slice(0, 25));
    } catch {
      if (requestId === searchRequestRef.current && !matchingRecipes.length && !matchingDiaryRecipes.length && !matchingPersonalFoods.length && !matchingDiaryFoods.length) setSearchError("Online food search is unavailable. You can still add a custom food.");
    } finally {
      if (requestId === searchRequestRef.current) setLoading(false);
    }
  }, [foods, matchingDiaryFoods.length, matchingDiaryRecipes.length, matchingPersonalFoods.length, matchingRecipes.length]);
  const search = async (event?: FormEvent) => { event?.preventDefault(); await runSearch(query); };
  useEffect(() => {
    if (view !== "search") return;
    const timer = window.setTimeout(() => { void runSearch(query); }, 700);
    return () => window.clearTimeout(timer);
  }, [query, runSearch, view]);
  const sendIntake = async (event: FormEvent) => {
    event.preventDefault();
    const message = intakeDraft.trim();
    if (!message || askingCoach) return;
    const soundsConversational = /\b(i|my|me|how|what|can|should|help|ate|eaten|bite|bites|slice|slices|calorie|protein|macro|portion)\b|[?]/i.test(message);
    setCoachReply(""); setIntakeError("");
    if (!soundsConversational) {
      setQuery(message); changeView("search"); await runSearch(message);
      return;
    }
    setAskingCoach(true);
    try {
      const session = await getSupabase()?.auth.getSession();
      const token = session?.data.session?.access_token;
      if (!token) throw new Error("Sign in to ask the Coach about your log.");
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message, history: [], localDate: localDateKey(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      const body: unknown = await response.json();
      const bodyRecord = body && typeof body === "object" ? body as Record<string, unknown> : {};
      if (!response.ok) throw new Error(typeof bodyRecord.error === "string" ? bodyRecord.error : "The Coach is unavailable right now.");
      if (typeof bodyRecord.reply !== "string") throw new Error("The Coach returned an invalid response.");
      setCoachReply(hideCalories ? hideCalorieValues(bodyRecord.reply) : bodyRecord.reply);
    } catch (caught) {
      setIntakeError(caught instanceof Error ? caught.message : "The Coach is unavailable right now.");
    } finally { setAskingCoach(false); }
  };
  const startVoiceSearch = () => {
    type VoiceResult = { 0?: { transcript?: string } };
    type VoiceRecognition = { lang: string; interimResults: boolean; maxAlternatives: number; start: () => void; onresult?: (event: { results: { [index: number]: VoiceResult } }) => void; onerror?: () => void; onend?: () => void };
    type VoiceRecognitionConstructor = new () => VoiceRecognition;
    const browser = window as unknown as { SpeechRecognition?: VoiceRecognitionConstructor; webkitSpeechRecognition?: VoiceRecognitionConstructor };
    const Recognition = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Recognition) { setIntakeError("Voice logging is not available in this browser. Type a food name instead."); return; }
    const recognition = new Recognition();
    recognition.lang = navigator.language || "en-US"; recognition.interimResults = false; recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const phrase = normalizeVoiceFoodQuery(event.results[0]?.[0]?.transcript || "");
      if (!phrase) { setIntakeError("I didn’t catch a food name. Try again or type it instead."); return; }
      setIntakeDraft(phrase); setQuery(phrase); changeView("search"); void runSearch(phrase);
    };
    recognition.onerror = () => setIntakeError("Voice logging stopped before a food name was captured. Try again or type it instead.");
    recognition.onend = () => setListening(false);
    setListening(true); setIntakeError(""); recognition.start();
  };
  const addImages = (files?: FileList | File[]) => {
    if (!files?.length) return;
    setPendingImages(Array.from(files).slice(0, 3));
    changeView("label");
  };
  const saveAndPick = async (food: Food, followUps: string[] = []) => {
    await onSaveFood(food);
    pick(food, followUps);
  };
  const barcode = async (code: string, fallback?: Food, followUps: string[] = [], persistFallback = false) => {
    setLoading(true); setManualNotice("");
    const cached = foods.find((food) => food.barcode === code);
    if (cached) {
      if (persistFallback && fallback) await saveAndPick(fallback, followUps);
      else pick(cached, followUps);
      setLoading(false);
      return;
    }
    try {
      const food = await findByBarcode(code);
      if (food) {
        if (persistFallback && fallback) await saveAndPick(fallback, followUps);
        else pick(food, followUps);
      } else if (fallback) {
        if (persistFallback) await saveAndPick(fallback, followUps);
        else pick(fallback, followUps);
      } else { setUnknownBarcode(code); setManualNotice("No product matched this barcode. You can scan its nutrition label or add the food by hand."); changeView("barcode-not-found"); }
    } catch {
      if (fallback) {
        if (persistFallback) await saveAndPick(fallback, followUps);
        else pick(fallback, followUps);
      } else { setUnknownBarcode(code); setManualNotice("We couldn’t look up this barcode right now. You can scan its nutrition label or add the food by hand."); changeView("barcode-not-found"); }
    }
    finally { setLoading(false); }
  };
  const handleLabelFood = async (food: Food, followUps: string[]) => {
    const labeledFood = food.barcode || !unknownBarcode ? food : { ...food, barcode: unknownBarcode };
    if (labeledFood.barcode) await barcode(labeledFood.barcode, labeledFood, followUps, true);
    else await saveAndPick(labeledFood, followUps);
  };
  if (selected) return <PortionSheet food={selected} questions={questions} initialMealType={initialMealType} hideCalories={hideCalories} onLog={onLog} onClose={() => setSelected(undefined)} />;
  if (view === "scan") return <>{loading && <div className="global-loader"><i />Looking up product…</div>}<BarcodeScanner onResult={barcode} onClose={() => changeView("start")} /></>;
  if (view === "camera") return <LabelReader initialFiles={pendingImages} initialAction="camera" onFood={(food, followUps) => { void handleLabelFood(food, followUps); }} onClose={() => { setPendingImages([]); changeView("start"); }} />;
  if (view === "photo") return <MealPhotoReader onMeal={onMealPhoto} onClose={() => changeView("start")} />;
  if (view === "label") return <LabelReader initialFiles={pendingImages} onFood={(food, followUps) => { void handleLabelFood(food, followUps); }} onClose={() => { setPendingImages([]); changeView("start"); }} />;
  if (view === "manual") return <ManualFood initialBarcode={unknownBarcode} notice={manualNotice} hideCalories={hideCalories} onSave={(food) => void saveAndPick(food)} onClose={() => changeView("start")} />;
  if (view === "quick") return <QuickMacroSheet hideCalories={hideCalories} onLog={onLog} onClose={() => changeView("start")} />;
  if (view === "barcode-not-found") return <div className="barcode-not-found"><div className="sheet-header"><button className="icon-button ghost" onClick={() => changeView("scan")} aria-label="Back to barcode scanner"><ArrowLeft /></button><div><span className="eyebrow">Barcode not found</span><h2>Let’s add this food</h2></div><span /></div><div className="barcode-not-found-copy"><span className="action-icon amber"><Package /></span><div><strong>No saved product matched {unknownBarcode}</strong><p>Use the package label to check the nutrition, or enter it yourself. We’ll save it for next time.</p></div></div><div className="barcode-not-found-actions"><button className="primary-button full" type="button" onClick={() => { setPendingImages([]); changeView("label"); }}><Camera size={18} />Scan nutrition label</button><button className="secondary-button full" type="button" onClick={() => changeView("manual")}><Pencil size={18} />Add by hand</button></div></div>;
  if (view === "search") return (
    <div>
      <div className="sheet-header"><button className="icon-button ghost" onClick={() => changeView("start")} aria-label="Back to add food options"><ArrowLeft /></button><div><span className="eyebrow">Food database</span><h2>Search</h2></div><span /></div>
      <form className="sheet-search" onSubmit={search}><Search size={19} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Food, recipe, brand or barcode" /><button type="submit">Search now</button></form>
      {loading && <div className="search-status" role="status"><i />Searching your library and packaged foods…</div>}
      {searchError && <div className="inline-alert" role="alert"><WifiOff size={17} />{searchError}</div>}
      {!!normalizedQuery && <div className="search-result-groups"><SearchResultGroup title="Your recipes" detail="Saved meals" empty={!matchingRecipes.length}><div className="food-list">{matchingRecipes.map((recipe) => <RecipeSearchRow key={recipe.id} recipe={recipe} hideCalories={hideCalories} onSelect={() => onSelectRecipe(recipe)} />)}</div></SearchResultGroup><SearchResultGroup title="Your foods" detail="Custom foods you saved" empty={!matchingPersonalFoods.length}><div className="food-list">{matchingPersonalFoods.map((food) => <FoodRow key={food.id} food={food} hideCalories={hideCalories} onSelect={() => pick(food)} />)}</div></SearchResultGroup><SearchResultGroup title="Recipes from your diary" detail="Previously logged recipes" empty={!matchingDiaryRecipes.length}><div className="food-list">{matchingDiaryRecipes.map((recipe) => <RecipeSearchRow key={recipe.id} recipe={recipe} hideCalories={hideCalories} onSelect={() => onSelectRecipe(recipe)} />)}</div></SearchResultGroup><SearchResultGroup title="From your diary" detail="Foods you logged before" empty={!matchingDiaryFoods.length}><div className="food-list">{matchingDiaryFoods.map((food) => <FoodRow key={food.id} food={food} hideCalories={hideCalories} onSelect={() => pick(food)} />)}</div></SearchResultGroup><SearchResultGroup title="Search results" detail="Open Food Facts" empty={!remoteResults.length && !loading}><div className="food-list">{remoteResults.map((food) => <FoodRow key={food.id} food={food} hideCalories={hideCalories} onSelect={() => pick(food)} />)}</div></SearchResultGroup></div>}
      {!loading && query && matchingRecipes.length + matchingDiaryRecipes.length + matchingPersonalFoods.length + matchingDiaryFoods.length + remoteResults.length === 0 && <div className="search-empty"><Database /><strong>No match yet</strong><p>Add it as a custom food and it will be ready next time.</p><button className="secondary-button" onClick={() => changeView("manual")}>Add custom food</button></div>}
      {!query && <div className="quick-list"><span className="eyebrow">Try something simple</span>{foods.slice(0, 6).map((food) => <FoodRow key={food.id} food={food} hideCalories={hideCalories} onSelect={() => pick(food)} />)}</div>}
      <div className="data-credit"><Database size={15} /><span>Product results by Open Food Facts · ODbL</span></div>
    </div>
  );
  return (
    <div className="coach-intake" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addImages(event.dataTransfer.files); }}>
      <div className="sheet-header"><span /><div><span className="eyebrow">Log with Coach</span><h2>Add food or get help</h2></div><span /></div>
      <div className="intake-actions"><button onClick={() => changeView("scan")}><ScanLine size={17} />Barcode</button><button onClick={() => { setPendingImages([]); changeView("camera"); }}><Camera size={17} />Take photo</button><button onClick={() => imageInputRef.current?.click()}><Upload size={17} />Add photos</button><button type="button" onClick={startVoiceSearch} disabled={listening}><Mic size={17} />{listening ? "Listening…" : "Voice"}</button><button type="button" onClick={() => changeView("quick")}><Plus size={17} />Quick macros</button></div>
      <input ref={imageInputRef} className="visually-hidden-file" type="file" accept="image/*" multiple onChange={(event) => addImages(event.target.files || undefined)} />
      <label className="intake-input-label" htmlFor="coach-intake">Search a food or ask Coach</label>
      <form className="intake-composer" onSubmit={sendIntake}><input id="coach-intake" autoFocus value={intakeDraft} onChange={(event) => setIntakeDraft(event.target.value)} placeholder="Food or question" /><button type="submit" disabled={!intakeDraft.trim() || askingCoach} aria-label="Send to Coach">{askingCoach ? <span className="coach-loader" /> : <Send />}</button></form>
      {coachReply && <div className="intake-reply"><span>Coach</span><p>{coachReply}</p><button className="text-button" onClick={() => { setQuery(intakeDraft); changeView("search"); void runSearch(intakeDraft); }}><Search size={16} />Find a food to log</button></div>}
      {intakeError && <div className="inline-alert error" role="alert"><Info size={17} />{intakeError}</div>}
      {!!recent.length && <div className="quick-list"><span className="eyebrow">Recent · one tap</span>{recent.map((food) => <FoodRow key={food.id} food={food} hideCalories={hideCalories} onSelect={() => pick(food)} />)}</div>}
      <button className="text-button intake-manual" onClick={() => changeView("manual")}><Pencil size={16} />Add custom food</button>
      <div className="simple-note"><ShieldCheck size={17} /><span>Barcode and saved-food search work directly. Package photos are sent to AI only after you add them.</span></div>
    </div>
  );
}
