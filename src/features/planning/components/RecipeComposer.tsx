"use client";

import { BookOpen, ChevronDown, ImagePlus, Plus, Share2, X } from "lucide-react";
import { FormEvent, KeyboardEvent, useRef, useState } from "react";
import { NumericInput } from "@/features/shared/NumericInput";
import { readMealImage } from "@/features/diary/DiaryView";
import { getSupabase } from "@/lib/supabase";
import { publishRecipeToCatalogue, unpublishRecipe } from "@/lib/cloud";
import { recipeNutritionEstimateSchema } from "@/lib/schemas";
import type { Recipe, RecipeDraft } from "@/lib/types";

type NutritionFields = { calories: string; protein: string; carbs: string; fat: string; fiber: string; sugar: string };
type FieldRow = { id: string; value: string };
type IngredientRow = { id: string; name: string; quantity: string };

const defaultNutrition: NutritionFields = { calories: "400", protein: "25", carbs: "45", fat: "12", fiber: "8", sugar: "6" };

const makeRow = (value = ""): FieldRow => ({ id: crypto.randomUUID(), value });
const rowsFrom = (values?: string[]) => (values?.length ? values.map(makeRow) : [makeRow()]);
const makeIngredientRow = (name = "", quantity = ""): IngredientRow => ({ id: crypto.randomUUID(), name, quantity });
const ingredientRowsFrom = (ingredients?: Recipe["ingredients"]) => (ingredients?.length ? ingredients.map((ingredient) => makeIngredientRow(ingredient.name, ingredient.quantity || "")) : [makeIngredientRow()]);

async function authToken() {
  return (await getSupabase()?.auth.getSession())?.data.session?.access_token;
}

/**
 * `recipe` is an existing saved recipe being edited; `initial` pre-fills a *new* one, which is
 * how a link import hands its draft over. Only one of the two is ever meaningful.
 */
export function RecipeComposer({ recipe, initial, userId, onSave }: { recipe?: Recipe; initial?: RecipeDraft; userId?: string; onSave: (recipe: Recipe) => void }) {
  const seed = recipe || initial;
  const [name, setName] = useState(seed?.name || "");
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>(() => ingredientRowsFrom(seed?.ingredients));
  const [instructionRows, setInstructionRows] = useState<FieldRow[]>(() => rowsFrom(seed?.instructions));
  const [servings, setServings] = useState(String(seed?.servings || 2));
  const [servingGrams, setServingGrams] = useState(String(seed?.servingGrams ?? 100));
  const [nutrition, setNutrition] = useState<NutritionFields>(seed ? { calories: String(seed.nutritionPerServing.calories), protein: String(seed.nutritionPerServing.protein), carbs: String(seed.nutritionPerServing.carbs), fat: String(seed.nutritionPerServing.fat), fiber: String(seed.nutritionPerServing.fiber), sugar: String(seed.nutritionPerServing.sugar) } : defaultNutrition);
  const [imageUrls, setImageUrls] = useState(seed?.imageUrls || []);
  const [imageError, setImageError] = useState("");
  const [share, setShare] = useState(Boolean(seed?.isPublic));
  const [estimating, setEstimating] = useState(false);
  const [estimateNote, setEstimateNote] = useState("");
  // A draft that already carries nutrition must not be silently re-estimated over.
  const [estimated, setEstimated] = useState(Boolean(initial));
  const [saving, setSaving] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(Boolean(seed?.isPublic));

  const ingredientRefs = useRef(new Map<string, HTMLInputElement>());
  const instructionRefs = useRef(new Map<string, HTMLTextAreaElement>());
  const focusRowRef = useRef<{ list: "ingredient" | "instruction"; id: string } | undefined>(undefined);

  const setNutrient = (key: keyof NutritionFields, value: string) => setNutrition((current) => ({ ...current, [key]: value }));
  const ingredientItems = ingredientRows.map((row) => ({ name: row.name.trim(), quantity: row.quantity.trim() })).filter((item) => item.name);
  const ingredientNames = ingredientItems.map((item) => (item.quantity ? `${item.quantity} ${item.name}` : item.name));
  const instructionSteps = instructionRows.map((row) => row.value.trim()).filter(Boolean);
  const basicsValid = Boolean(name.trim()) && Number.isFinite(Number(servings)) && Number(servings) > 0 && Number.isFinite(Number(servingGrams)) && Number(servingGrams) > 0 && ingredientItems.length > 0;
  const canShare = imageUrls.length > 0;

  const focusRow = (list: "ingredient" | "instruction", id: string) => { focusRowRef.current = { list, id }; };
  const attachIngredientRef = (id: string) => (el: HTMLInputElement | null) => {
    if (el) { ingredientRefs.current.set(id, el); if (focusRowRef.current?.list === "ingredient" && focusRowRef.current.id === id) { el.focus(); focusRowRef.current = undefined; } }
    else ingredientRefs.current.delete(id);
  };
  const attachInstructionRef = (id: string) => (el: HTMLTextAreaElement | null) => {
    if (el) { instructionRefs.current.set(id, el); if (focusRowRef.current?.list === "instruction" && focusRowRef.current.id === id) { el.focus(); focusRowRef.current = undefined; } }
    else instructionRefs.current.delete(id);
  };

  const addIngredientRow = (afterId?: string) => {
    const row = makeIngredientRow();
    setIngredientRows((current) => { const index = afterId ? current.findIndex((item) => item.id === afterId) : current.length - 1; return [...current.slice(0, index + 1), row, ...current.slice(index + 1)]; });
    focusRow("ingredient", row.id);
  };
  const updateIngredientName = (id: string, value: string) => setIngredientRows((current) => current.map((row) => (row.id === id ? { ...row, name: value } : row)));
  const updateIngredientQuantity = (id: string, value: string) => setIngredientRows((current) => current.map((row) => (row.id === id ? { ...row, quantity: value } : row)));
  const removeIngredientRow = (id: string, index: number) => {
    setIngredientRows((current) => (current.length > 1 ? current.filter((row) => row.id !== id) : [makeIngredientRow()]));
    if (index > 0) { const previous = ingredientRows[index - 1]; if (previous) focusRow("ingredient", previous.id); }
  };
  const handleIngredientKeyDown = (event: KeyboardEvent<HTMLInputElement>, row: IngredientRow, index: number) => {
    if (event.key === "Enter") { event.preventDefault(); addIngredientRow(row.id); }
    else if (event.key === "Backspace" && row.name === "" && row.quantity === "" && ingredientRows.length > 1) { event.preventDefault(); removeIngredientRow(row.id, index); }
  };

  const addInstructionRow = (afterId?: string) => {
    const row = makeRow();
    setInstructionRows((current) => { const index = afterId ? current.findIndex((item) => item.id === afterId) : current.length - 1; return [...current.slice(0, index + 1), row, ...current.slice(index + 1)]; });
    focusRow("instruction", row.id);
  };
  const updateInstructionRow = (id: string, value: string) => setInstructionRows((current) => current.map((row) => (row.id === id ? { ...row, value } : row)));
  const removeInstructionRow = (id: string, index: number) => {
    setInstructionRows((current) => (current.length > 1 ? current.filter((row) => row.id !== id) : [makeRow()]));
    if (index > 0) { const previous = instructionRows[index - 1]; if (previous) focusRow("instruction", previous.id); }
  };
  const handleInstructionKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>, row: FieldRow, index: number) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); addInstructionRow(row.id); }
    else if (event.key === "Backspace" && row.value === "" && instructionRows.length > 1) { event.preventDefault(); removeInstructionRow(row.id, index); }
  };
  const autoGrowInstruction = (element: HTMLTextAreaElement) => { element.style.height = "auto"; element.style.height = `${element.scrollHeight}px`; };

  const estimate = async () => {
    if (!ingredientNames.length) return;
    setEstimating(true); setEstimateNote("");
    try {
      const token = await authToken();
      const response = await fetch("/api/recipes/estimate-nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ ingredients: ingredientNames, servings: Number(servings), servingGrams: Number(servingGrams) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not estimate nutrition.");
      const parsed = recipeNutritionEstimateSchema.parse(body);
      const { nutritionPerServing } = parsed;
      setNutrition({
        calories: String(Math.round(nutritionPerServing.calories)), protein: String(Math.round(nutritionPerServing.protein)),
        carbs: String(Math.round(nutritionPerServing.carbs)), fat: String(Math.round(nutritionPerServing.fat)),
        fiber: String(Math.round(nutritionPerServing.fiber)), sugar: String(Math.round(nutritionPerServing.sugar)),
      });
      setEstimateNote(`Estimated (${parsed.confidence} confidence) — check it against what you actually used.`);
      setEstimated(true);
    } catch (error) {
      setEstimateNote(error instanceof Error ? error.message : "Could not estimate nutrition. Enter it manually below.");
    } finally { setEstimating(false); }
  };

  const openAdvanced = () => {
    setAdvancedOpen(true);
    if (!recipe && !estimated && basicsValid) void estimate();
  };

  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setImageError("");
    try { const remaining = 1 - imageUrls.length; if (remaining <= 0) throw new Error("A recipe can include 1 photo."); const images = await Promise.all([...files].slice(0, remaining).map(readMealImage)); setImageUrls((current) => [...current, ...images]); } catch (error) { setImageError(error instanceof Error ? error.message : "The photo could not be added."); }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Object.fromEntries(Object.entries(nutrition).map(([key, value]) => [key, Number(value)])) as Record<keyof NutritionFields, number>;
    const gramsPerServing = Number(servingGrams);
    if (!basicsValid || Object.values(values).some((value) => !Number.isFinite(value) || value < 0)) return;
    const now = new Date().toISOString();
    const nextRecipe: Recipe = {
      id: recipe?.id || `recipe-${crypto.randomUUID()}`, name: name.trim(), servings: Number(servings), servingGrams: gramsPerServing,
      ingredients: ingredientItems.map((item, index) => ({ ...recipe?.ingredients[index], id: recipe?.ingredients[index]?.id || `ingredient-${crypto.randomUUID()}`, name: item.name, quantity: item.quantity || undefined })),
      instructions: instructionSteps, cuisine: seed?.cuisine, dietaryTags: seed?.dietaryTags,
      nutritionPerServing: values, imageUrls, isPublic: seed?.isPublic, publicRecipeId: seed?.publicRecipeId, origin: seed?.origin,
      importedFrom: seed?.importedFrom,
      createdAt: recipe?.createdAt || now, updatedAt: now,
    };
    setSaving(true);
    try {
      let finalRecipe = nextRecipe;
      if (userId) {
        if (share && canShare && !nextRecipe.publicRecipeId) {
          const publicRecipeId = await publishRecipeToCatalogue(userId, nextRecipe);
          finalRecipe = { ...nextRecipe, isPublic: true, publicRecipeId };
        } else if ((!share || !canShare) && nextRecipe.publicRecipeId) {
          await unpublishRecipe(userId, nextRecipe.publicRecipeId);
          finalRecipe = { ...nextRecipe, isPublic: false, publicRecipeId: undefined };
        } else {
          finalRecipe = { ...nextRecipe, isPublic: share && canShare };
        }
      }
      onSave(finalRecipe);
      if (!seed) { setName(""); setIngredientRows([makeIngredientRow()]); setInstructionRows([makeRow()]); setServings("2"); setServingGrams("100"); setNutrition(defaultNutrition); setImageUrls([]); setShare(false); setEstimateNote(""); setEstimated(false); setAdvancedOpen(false); }
    } catch (error) {
      setEstimateNote(error instanceof Error ? error.message : "Saved locally, but the catalogue could not be updated.");
      onSave(nextRecipe);
    } finally { setSaving(false); }
  };

  return <form className="recipe-composer" onSubmit={submit}>
    <div className="form-grid two">
      <label className="span-two"><span>Recipe name</span><input required value={name} maxLength={240} onChange={(event) => setName(event.target.value)} placeholder="e.g. Weeknight lentil bowl" /></label>
      <label><span>Servings</span><NumericInput required min="0.5" max="100" step="0.5" value={servings} onChange={(event) => setServings(event.target.value)} /></label>
      <label><span>Grams per serving</span><NumericInput required min="1" max="20000" step="1" value={servingGrams} onChange={(event) => setServingGrams(event.target.value)} /></label>
    </div>

    <div className="recipe-field-group">
      <span className="recipe-field-label">Ingredients</span>
      <div className="recipe-field-list">
        {ingredientRows.map((row, index) => <div className="recipe-field-row" key={row.id}>
          <input
            className="recipe-field-qty"
            value={row.quantity}
            maxLength={40}
            placeholder="Amount"
            aria-label="Ingredient amount"
            onChange={(event) => updateIngredientQuantity(row.id, event.target.value)}
            onKeyDown={(event) => handleIngredientKeyDown(event, row, index)}
          />
          <input
            ref={attachIngredientRef(row.id)}
            value={row.name}
            maxLength={200}
            placeholder={index === 0 ? "e.g. spinach" : "Add ingredient"}
            aria-label="Ingredient name"
            onChange={(event) => updateIngredientName(row.id, event.target.value)}
            onKeyDown={(event) => handleIngredientKeyDown(event, row, index)}
          />
          <button type="button" className="recipe-field-remove" aria-label="Remove ingredient" onClick={() => removeIngredientRow(row.id, index)}><X size={14} /></button>
        </div>)}
      </div>
      <button type="button" className="recipe-field-add" onClick={() => addIngredientRow()}><Plus size={14} />Add ingredient</button>
    </div>

    <div className="recipe-field-group">
      <span className="recipe-field-label">Instructions</span>
      <div className="recipe-field-list numbered">
        {instructionRows.map((row, index) => <div className="recipe-field-row" key={row.id}>
          <span className="recipe-field-index">{index + 1}</span>
          <textarea
            ref={attachInstructionRef(row.id)}
            rows={1}
            value={row.value}
            maxLength={500}
            placeholder={index === 0 ? "e.g. Sauté onion until soft" : "Add step"}
            onChange={(event) => { updateInstructionRow(row.id, event.target.value); autoGrowInstruction(event.currentTarget); }}
            onKeyDown={(event) => handleInstructionKeyDown(event, row, index)}
          />
          <button type="button" className="recipe-field-remove" aria-label="Remove step" onClick={() => removeInstructionRow(row.id, index)}><X size={14} /></button>
        </div>)}
      </div>
      <button type="button" className="recipe-field-add" onClick={() => addInstructionRow()}><Plus size={14} />Add step</button>
    </div>

    <details className="recipe-advanced" open={advancedOpen} onToggle={(event) => { if (event.currentTarget.open) openAdvanced(); else setAdvancedOpen(false); }}>
      <summary><span><strong>Nutrition &amp; sharing</strong><small>Add a photo, macros, and dietary tags — only needed to share this recipe publicly.</small></span><ChevronDown size={17} /></summary>

      <label className="recipe-photo-upload"><input className="visually-hidden-file" type="file" accept="image/*" onChange={(event) => { void addImages(event.target.files); event.currentTarget.value = ""; }} /><span className="action-icon mint"><ImagePlus size={17} /></span><span><strong>Add photo</strong><small>Optional · 1 photo · required to share</small></span></label>
      {imageUrls.length > 0 && <div className="recipe-photo-preview" aria-label={`${imageUrls.length} recipe ${imageUrls.length === 1 ? "photo" : "photos"}`}>{imageUrls.map((url, index) => <span key={url}><img src={url} alt={`Recipe photo ${index + 1}`} /><button type="button" onClick={() => setImageUrls((current) => current.filter((candidate) => candidate !== url))} aria-label={`Remove recipe photo ${index + 1}`}><X size={14} /></button></span>)}</div>}
      {imageError && <div className="inline-alert" role="status">{imageError}</div>}

      <div className="recipe-nutrition">
        <div className="recipe-estimate-row"><span className="eyebrow">Per serving</span><button className="text-button" type="button" onClick={() => void estimate()} disabled={estimating}>{estimating ? "Estimating…" : "Re-estimate"}</button></div>
        {estimating && <span className="analyzing"><i /><strong>Estimating nutrition…</strong></span>}
        {estimateNote && !estimating && <div className="inline-alert" role="status">{estimateNote}</div>}
        <div className="form-grid three">{(["calories", "protein", "carbs", "fat", "fiber", "sugar"] as const).map((key) => <label key={key}><span>{key === "fiber" ? "Fibre" : key[0].toUpperCase() + key.slice(1)}</span><NumericInput required min="0" step="0.1" value={nutrition[key]} onChange={(event) => setNutrient(key, event.target.value)} /></label>)}</div>
      </div>

      {userId && <label className={`recipe-share-toggle${canShare ? "" : " disabled"}`}><input type="checkbox" checked={share} disabled={!canShare} onChange={(event) => setShare(event.target.checked)} /><span><Share2 size={15} /><strong>Share to catalogue</strong><small>{canShare ? "Other users can discover and plan this recipe." : "Add a photo above to unlock sharing."}</small></span></label>}
      {share && seed?.importedFrom && <div className="inline-alert" role="status">This recipe came from {seed.importedFrom.siteName || "another site"}. Only share it publicly if you have the right to republish it.</div>}
    </details>

    <div className="recipe-composer-actions">
      <button className="primary-button" type="submit" disabled={!basicsValid || saving}><BookOpen size={17} />{saving ? "Saving…" : recipe ? "Save changes" : "Save recipe"}</button>
    </div>
  </form>;
}
