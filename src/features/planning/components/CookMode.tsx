"use client";

import { ChevronLeft, ChevronRight, ListChecks, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { RecipeDetailIngredient } from "./RecipeDetail";
import { scaleIngredientQuantity } from "@/lib/planning";

/** Full-screen step-by-step cook flow: one instruction at a time, with the ingredient list a tap away. */
export function CookMode({ name, ingredients, scaleFactor, instructions, onClose }: {
  name: string;
  ingredients: RecipeDetailIngredient[];
  scaleFactor: number;
  instructions: string[];
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const lastStep = instructions.length - 1;

  useEffect(() => {
    document.body.classList.add("sheet-open");
    return () => document.body.classList.remove("sheet-open");
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { if (showIngredients) setShowIngredients(false); else onClose(); }
      if (event.key === "ArrowRight") setStep((current) => Math.min(lastStep, current + 1));
      if (event.key === "ArrowLeft") setStep((current) => Math.max(0, current - 1));
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [lastStep, onClose, showIngredients]);

  if (!instructions.length) return null;

  const overlay = <div className="cook-mode" role="dialog" aria-modal="true" aria-label={`Cooking ${name}`}>
    <header className="cook-mode-header">
      <button type="button" className="icon-button ghost" aria-label="Close cook mode" onClick={onClose}><X size={18} /></button>
      <span>{name}</span>
      <button type="button" className="icon-button ghost" aria-label="Show ingredients" onClick={() => setShowIngredients(true)}><ListChecks size={18} /></button>
    </header>

    <div className="cook-mode-progress" aria-hidden="true"><i style={{ width: `${((step + 1) / instructions.length) * 100}%` }} /></div>
    <p className="cook-mode-step-label">Step {step + 1} of {instructions.length}</p>

    <div className="cook-mode-body"><p key={step}>{instructions[step]}</p></div>

    <div className="cook-mode-nav">
      <button type="button" className="secondary-button" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}><ChevronLeft size={18} />Back</button>
      {step === lastStep
        ? <button type="button" className="primary-button" onClick={onClose}>Done cooking</button>
        : <button type="button" className="primary-button" onClick={() => setStep((current) => Math.min(lastStep, current + 1))}>Next<ChevronRight size={18} /></button>}
    </div>

    {showIngredients && <div className="cook-mode-ingredients-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setShowIngredients(false); }}>
      <div className="cook-mode-ingredients" role="dialog" aria-modal="true" aria-label="Ingredients">
        <div className="sheet-header"><div><h2>Ingredients</h2></div><button type="button" className="icon-button ghost" aria-label="Close ingredients" onClick={() => setShowIngredients(false)}><X size={18} /></button></div>
        <ul className="recipe-view-ingredients">{ingredients.map((ingredient) => <li key={ingredient.id}>{ingredient.quantity ? `${scaleIngredientQuantity(ingredient.quantity, scaleFactor)} ` : ""}{ingredient.name}</li>)}</ul>
      </div>
    </div>}
  </div>;

  return typeof document !== "undefined" ? createPortal(overlay, document.body) : null;
}
