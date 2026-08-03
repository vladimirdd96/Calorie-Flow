"use client";

import { BookOpen, ChevronRight, ImagePlus, Share2, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { NumericInput } from "@/features/shared/NumericInput";
import { readMealImage } from "@/features/diary/DiaryView";
import { getSupabase } from "@/lib/supabase";
import { publishRecipeToCatalogue, unpublishRecipe } from "@/lib/cloud";
import { recipeNutritionEstimateSchema } from "@/lib/schemas";
import type { Recipe } from "@/lib/types";

type Step = "basics" | "nutrition";
type NutritionFields = { calories: string; protein: string; carbs: string; fat: string; fiber: string; sugar: string };

const defaultNutrition: NutritionFields = { calories: "400", protein: "25", carbs: "45", fat: "12", fiber: "8", sugar: "6" };

async function authToken() {
  return (await getSupabase()?.auth.getSession())?.data.session?.access_token;
}

export function RecipeComposer({ recipe, userId, onSave }: { recipe?: Recipe; userId?: string; onSave: (recipe: Recipe) => void }) {
  const [step, setStep] = useState<Step>("basics");
  const [name, setName] = useState(recipe?.name || "");
  const [ingredients, setIngredients] = useState(recipe?.ingredients.map((ingredient) => ingredient.name).join("\n") || "");
  const [servings, setServings] = useState(String(recipe?.servings || 2));
  const [servingGrams, setServingGrams] = useState(String(recipe?.servingGrams ?? 100));
  const [nutrition, setNutrition] = useState<NutritionFields>(recipe ? { calories: String(recipe.nutritionPerServing.calories), protein: String(recipe.nutritionPerServing.protein), carbs: String(recipe.nutritionPerServing.carbs), fat: String(recipe.nutritionPerServing.fat), fiber: String(recipe.nutritionPerServing.fiber), sugar: String(recipe.nutritionPerServing.sugar) } : defaultNutrition);
  const [imageUrls, setImageUrls] = useState(recipe?.imageUrls || []);
  const [imageError, setImageError] = useState("");
  const [share, setShare] = useState(Boolean(recipe?.isPublic));
  const [estimating, setEstimating] = useState(false);
  const [estimateNote, setEstimateNote] = useState("");
  const [saving, setSaving] = useState(false);

  const setNutrient = (key: keyof NutritionFields, value: string) => setNutrition((current) => ({ ...current, [key]: value }));
  const ingredientNames = ingredients.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
  const basicsValid = Boolean(name.trim()) && Number.isFinite(Number(servings)) && Number(servings) > 0 && Number.isFinite(Number(servingGrams)) && Number(servingGrams) > 0 && ingredientNames.length > 0;

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
    } catch (error) {
      setEstimateNote(error instanceof Error ? error.message : "Could not estimate nutrition. Enter it manually below.");
    } finally { setEstimating(false); }
  };

  const goToNutrition = () => {
    if (!basicsValid) return;
    setStep("nutrition");
    if (!recipe) void estimate();
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
      ingredients: ingredientNames.map((item, index) => ({ ...recipe?.ingredients[index], id: recipe?.ingredients[index]?.id || `ingredient-${crypto.randomUUID()}`, name: item })),
      nutritionPerServing: values, imageUrls, isPublic: recipe?.isPublic, publicRecipeId: recipe?.publicRecipeId,
      createdAt: recipe?.createdAt || now, updatedAt: now,
    };
    setSaving(true);
    try {
      let finalRecipe = nextRecipe;
      if (userId) {
        if (share && !nextRecipe.publicRecipeId) {
          const publicRecipeId = await publishRecipeToCatalogue(userId, nextRecipe);
          finalRecipe = { ...nextRecipe, isPublic: true, publicRecipeId };
        } else if (!share && nextRecipe.publicRecipeId) {
          await unpublishRecipe(userId, nextRecipe.publicRecipeId);
          finalRecipe = { ...nextRecipe, isPublic: false, publicRecipeId: undefined };
        } else {
          finalRecipe = { ...nextRecipe, isPublic: share };
        }
      }
      onSave(finalRecipe);
      if (!recipe) { setName(""); setIngredients(""); setServings("2"); setServingGrams("100"); setNutrition(defaultNutrition); setImageUrls([]); setShare(false); setEstimateNote(""); setStep("basics"); }
    } catch (error) {
      setEstimateNote(error instanceof Error ? error.message : "Saved locally, but the catalogue could not be updated.");
      onSave(nextRecipe);
    } finally { setSaving(false); }
  };

  return <form className="recipe-composer" onSubmit={submit}>
    <div className="recipe-composer-steps"><span className={step === "basics" ? "active" : "done"}>1 · Basics</span><span className={step === "nutrition" ? "active" : ""}>2 · Nutrition</span></div>
    {step === "basics" && <>
      <div className="form-grid two">
        <label className="span-two"><span>Recipe name</span><input required value={name} maxLength={240} onChange={(event) => setName(event.target.value)} placeholder="e.g. Weeknight lentil bowl" /></label>
        <label><span>Servings</span><NumericInput required min="0.5" max="100" step="0.5" value={servings} onChange={(event) => setServings(event.target.value)} /></label>
        <label><span>Grams per serving</span><NumericInput required min="1" max="20000" step="1" value={servingGrams} onChange={(event) => setServingGrams(event.target.value)} /></label>
        <label className="span-two"><span>Ingredients</span><textarea required value={ingredients} maxLength={5000} onChange={(event) => setIngredients(event.target.value)} placeholder="One ingredient per line" /></label>
      </div>
      <label className="recipe-photo-upload"><input className="visually-hidden-file" type="file" accept="image/*" onChange={(event) => { void addImages(event.target.files); event.currentTarget.value = ""; }} /><span className="action-icon mint"><ImagePlus size={17} /></span><span><strong>Add photo</strong><small>Optional · 1 photo</small></span></label>
      {imageUrls.length > 0 && <div className="recipe-photo-preview" aria-label={`${imageUrls.length} recipe ${imageUrls.length === 1 ? "photo" : "photos"}`}>{imageUrls.map((url, index) => <span key={url}><img src={url} alt={`Recipe photo ${index + 1}`} /><button type="button" onClick={() => setImageUrls((current) => current.filter((candidate) => candidate !== url))} aria-label={`Remove recipe photo ${index + 1}`}><X size={14} /></button></span>)}</div>}
      {imageError && <div className="inline-alert" role="status">{imageError}</div>}
      <button className="primary-button" type="button" disabled={!basicsValid} onClick={goToNutrition}>Next: Nutrition<ChevronRight size={17} /></button>
    </>}
    {step === "nutrition" && <>
      <div className="recipe-nutrition">
        <div className="recipe-estimate-row"><span className="eyebrow">Per serving</span><button className="text-button" type="button" onClick={() => void estimate()} disabled={estimating}>{estimating ? "Estimating…" : "Re-estimate"}</button></div>
        {estimating && <span className="analyzing"><i /><strong>Estimating nutrition…</strong></span>}
        {estimateNote && !estimating && <div className="inline-alert" role="status">{estimateNote}</div>}
        <div className="form-grid three">{(["calories", "protein", "carbs", "fat", "fiber", "sugar"] as const).map((key) => <label key={key}><span>{key === "fiber" ? "Fibre" : key[0].toUpperCase() + key.slice(1)}</span><NumericInput required min="0" step="0.1" value={nutrition[key]} onChange={(event) => setNutrient(key, event.target.value)} /></label>)}</div>
      </div>
      {userId && <label className="recipe-share-toggle"><input type="checkbox" checked={share} onChange={(event) => setShare(event.target.checked)} /><span><Share2 size={15} /><strong>Share to catalogue</strong><small>Other users can discover and plan this recipe.</small></span></label>}
      <div className="recipe-composer-actions">
        <button className="secondary-button" type="button" onClick={() => setStep("basics")}>Back</button>
        <button className="primary-button" type="submit" disabled={saving}><BookOpen size={17} />{saving ? "Saving…" : recipe ? "Save changes" : "Save recipe"}</button>
      </div>
    </>}
  </form>;
}
