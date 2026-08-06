"use client";

import { BookOpen, ClipboardPaste, CopyCheck, ExternalLink, Link2, RotateCcw } from "lucide-react";
import { useState } from "react";
import { RecipeComposer } from "./RecipeComposer";
import { findDuplicateRecipe } from "@/lib/planning";
import { getSupabase } from "@/lib/supabase";
import { recipeImportNutritionSources, recipeImportResultSchema, type RecipeImportResult } from "@/lib/schemas";
import { recipeOrigins } from "@/lib/types";
import type { Recipe, RecipeDraft } from "@/lib/types";

async function authToken() {
  return (await getSupabase()?.auth.getSession())?.data.session?.access_token;
}

/** Turns the endpoint's result into the draft the composer pre-fills. */
function draftFromImport(result: RecipeImportResult): RecipeDraft {
  const { recipe, source } = result;
  return {
    name: recipe.name,
    servings: recipe.servings,
    servingGrams: recipe.servingGrams,
    ingredients: recipe.ingredients.map((ingredient) => ({ id: `ingredient-${crypto.randomUUID()}`, name: ingredient.name, quantity: ingredient.quantity })),
    nutritionPerServing: recipe.nutritionPerServing,
    instructions: recipe.instructions,
    cuisine: recipe.cuisine,
    dietaryTags: recipe.dietaryTags,
    imageUrls: source.imageUrl ? [source.imageUrl] : undefined,
    origin: recipeOrigins.imported,
    importedFrom: source.url ? { url: source.url, siteName: source.siteName } : undefined,
  };
}

function nutritionNote(result: RecipeImportResult): string {
  if (result.nutritionSource === recipeImportNutritionSources.site) return "Nutrition came from the original page.";
  if (result.nutritionSource === recipeImportNutritionSources.estimated) return `Nutrition is an estimate (${result.confidence} confidence) — check it before you rely on it.`;
  return "We couldn't work out the nutrition. Add it under “Nutrition & sharing” below.";
}

export function RecipeImportSheet({ userId, recipes, onSave, onOpenExisting }: {
  userId?: string;
  /** The user's existing recipes, so an import can warn before it becomes a second copy. */
  recipes: Recipe[];
  onSave: (recipe: Recipe) => void;
  onOpenExisting: (recipe: Recipe) => void;
}) {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [importing, setImporting] = useState<"url" | "text">();
  const [error, setError] = useState("");
  const [result, setResult] = useState<RecipeImportResult>();

  const runImport = async (body: { url: string } | { text: string }) => {
    setImporting("url" in body ? "url" : "text");
    setError("");
    try {
      const token = await authToken();
      const response = await fetch("/api/recipes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) {
        // A link we couldn't read is what the paste box exists for; a paste that failed is already there.
        if ("url" in body && (response.status === 422 || response.status === 502)) setPasteOpen(true);
        throw new Error(payload.error || "That recipe could not be imported.");
      }
      setResult(recipeImportResultSchema.parse(payload));
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "That recipe could not be imported.");
    } finally {
      setImporting(undefined);
    }
  };

  if (result) {
    const draft = draftFromImport(result);
    const duplicate = findDuplicateRecipe(recipes, draft);
    return <div className="recipe-import-sheet">
      <div className="sheet-header"><div><span className="eyebrow">Imported recipe</span><h2>Check it before saving</h2></div><span /></div>
      <div className="recipe-import-source">
        {result.source.url
          ? <a href={result.source.url} target="_blank" rel="noreferrer noopener"><ExternalLink size={14} />From {result.source.siteName || "the original page"}</a>
          : <span><ClipboardPaste size={14} />From pasted text</span>}
        {result.source.author && <small>By {result.source.author}</small>}
      </div>
      {duplicate && <div className="recipe-import-duplicate" role="status">
        <CopyCheck size={17} />
        <div>
          <strong>You already have this one</strong>
          <small>“{duplicate.name}” is already in your library. Saving again adds a second copy.</small>
        </div>
        <button type="button" className="secondary-button" onClick={() => onOpenExisting(duplicate)}><BookOpen size={15} />Open the one you have</button>
      </div>}
      <div className="inline-alert" role="status">{nutritionNote(result)}</div>
      <RecipeComposer initial={draft} userId={userId} onSave={onSave} />
      <button type="button" className="text-button recipe-import-restart" onClick={() => { setResult(undefined); setUrl(""); setText(""); setPasteOpen(false); }}><RotateCcw size={15} />Import a different recipe</button>
    </div>;
  }

  return <div className="recipe-import-sheet">
    <div className="sheet-header"><div><span className="eyebrow">Your recipes</span><h2>Import from a link</h2></div><span /></div>
    <p className="recipe-import-intro">Paste a link to a recipe page and we&apos;ll pull in the ingredients, steps, and nutrition. It stays private to your library until you choose to share it.</p>

    <form className="recipe-import-form" onSubmit={(event) => { event.preventDefault(); if (url.trim()) void runImport({ url: url.trim() }); }}>
      <label><span>Recipe link</span>
        <input
          autoFocus
          type="url"
          inputMode="url"
          value={url}
          maxLength={2000}
          placeholder="https://…"
          onChange={(event) => setUrl(event.target.value)}
        />
      </label>
      <button className="primary-button" type="submit" disabled={Boolean(importing) || !url.trim()}><Link2 size={17} />{importing ? "Importing…" : "Import recipe"}</button>
    </form>

    {importing && <span className="recipe-import-status" role="status"><i />{importing === "url" ? "Reading the page…" : "Reading the recipe…"}</span>}
    {error && !importing && <div className="inline-alert" role="alert">{error}</div>}

    <details className="recipe-import-paste" open={pasteOpen} onToggle={(event) => setPasteOpen(event.currentTarget.open)}>
      <summary><ClipboardPaste size={15} />Paste the recipe text instead</summary>
      <p>Some sites — social posts, paywalls, and login walls among them — block automatic reading. Copy the recipe and paste it here.</p>
      <textarea
        rows={8}
        value={text}
        maxLength={40000}
        placeholder={"4 servings\n\n2 cups red lentils\n1 onion, diced\n…"}
        onChange={(event) => setText(event.target.value)}
      />
      <button className="secondary-button" type="button" disabled={Boolean(importing) || text.trim().length < 40} onClick={() => void runImport({ text: text.trim() })}><ClipboardPaste size={16} />Import pasted recipe</button>
    </details>
  </div>;
}
