"use client";
/* eslint-disable @next/next/no-img-element -- the reviewed meal photo is a local data URL. */

import { Camera, Check, Info, Plus, Sparkles, Trash2 } from "lucide-react";
import { type FormEvent, useMemo, useRef, useState } from "react";
import { ClearableInput } from "@/features/shared/ClearableInput";
import { DatePickerField } from "@/features/shared/DatePicker";
import { NumericInput } from "@/features/shared/NumericInput";
import { resizeFoodImage } from "@/lib/image";
import { round, suggestedMealType } from "@/lib/nutrition";
import type { Meal, MealPhotoAnalysis, MealTimeBoundaries, MealType } from "@/lib/types";
import { mealPhotoTotals, mealFromPhoto, portionScales, reviewItems, resizeItem, scaleItems, type PortionScaleId, type ReviewItem } from "../mealPhoto";

const mealLabels: Record<MealType, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };
const confidenceCopy: Record<MealPhotoAnalysis["confidence"], { label: string; detail: string }> = {
  high: { label: "Clear photo", detail: "The foods were easy to read. Check the portions anyway." },
  medium: { label: "Rough estimate", detail: "The foods look right, the weights are inferred. Adjust anything that looks off." },
  low: { label: "Low confidence", detail: "This one was hard to read. Correct the portions, or add a detail below and estimate again." },
};

export function MealPhotoReview({ analysis, image, hideCalories, initialMealType, initialLoggedDate, mealTimeBoundaries, onRetake, onReanalyze, onLogMeal, onClose }: {
  analysis: MealPhotoAnalysis;
  image: string;
  hideCalories: boolean;
  initialMealType?: MealType;
  initialLoggedDate: string;
  mealTimeBoundaries?: MealTimeBoundaries;
  onRetake: () => void;
  onReanalyze: (hint: string) => void;
  onLogMeal: (meal: Meal) => void;
  onClose: () => void;
}) {
  const [dish, setDish] = useState(analysis.name);
  const [items, setItems] = useState<ReviewItem[]>(() => reviewItems(analysis));
  const [scale, setScale] = useState<PortionScaleId>("shown");
  const [mealType, setMealType] = useState<MealType>(initialMealType || analysis.mealType || suggestedMealType(new Date(), mealTimeBoundaries));
  const [loggedDate, setLoggedDate] = useState(initialLoggedDate);
  const [hint, setHint] = useState("");
  const [error, setError] = useState("");
  const baseItems = useRef(reviewItems(analysis));
  const totals = useMemo(() => mealPhotoTotals(items), [items]);
  const confidence = confidenceCopy[analysis.confidence];

  const applyScale = (next: PortionScaleId) => {
    const factor = portionScales.find((option) => option.id === next)?.factor ?? 1;
    setScale(next);
    setItems((current) => scaleItems(baseItems.current, factor).map((item) => ({ ...item, included: current.find((candidate) => candidate.id === item.id)?.included ?? true })));
  };
  const setGrams = (id: string, grams: number) => setItems((current) => current.map((item) => item.id === id ? resizeItem(item, grams) : item));
  const toggle = (id: string) => setItems((current) => current.map((item) => item.id === id ? { ...item, included: !item.included } : item));
  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    baseItems.current = baseItems.current.filter((item) => item.id !== id);
  };
  const addItem = () => {
    const id = `manual-${crypto.randomUUID()}`;
    const item: ReviewItem = { id, included: true, name: "", portion: "Added by you", grams: 100, nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 } };
    setItems((current) => [...current, item]);
    baseItems.current = [...baseItems.current, item];
  };
  const rename = (id: string, name: string) => setItems((current) => current.map((item) => item.id === id ? { ...item, name } : item));
  const setCalories = (id: string, calories: number) => setItems((current) => current.map((item) => item.id === id ? { ...item, nutrition: { ...item.nutrition, calories: round(Math.max(0, calories), 0) } } : item));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!totals.count) { setError("Keep at least one food to log this meal."); return; }
    if (items.some((item) => item.included && !item.name.trim())) { setError("Name every food you are logging."); return; }
    void (async () => {
      let imageUrl: string | undefined;
      // A photo that cannot be shrunk small enough is not worth blocking the log for.
      try { imageUrl = await resizeFoodImage(image); } catch { imageUrl = undefined; }
      onLogMeal(mealFromPhoto({ items, dish, mealType, loggedDate, imageUrl }));
    })();
  };

  return <div className="meal-photo-review">
    <div className="sheet-header">
      <button type="button" className="icon-button ghost" onClick={onRetake} aria-label="Take another photo"><Camera /></button>
      <div><span className="eyebrow">AI estimate</span><h2>Check this meal</h2></div>
      <span />
    </div>

    <form className="meal-photo-review-form" onSubmit={submit}>
      <section className="meal-photo-summary">
        <img src={image} alt="The meal you photographed" />
        <div>
          <span className={`meal-photo-confidence ${analysis.confidence}`}><Sparkles size={13} />{confidence.label}</span>
          <label className="meal-photo-dish"><span>Meal name</span><ClearableInput value={dish} onChange={(event) => setDish(event.target.value)} onClear={() => setDish("")} maxLength={240} placeholder="e.g. Chicken, rice and broccoli" clearLabel="Clear meal name" /></label>
          <p>{confidence.detail}</p>
        </div>
      </section>

      <section className="meal-photo-totals" aria-label="Estimated nutrition for this meal">
        {!hideCalories && <strong>{Math.round(totals.nutrition.calories)}<small>kcal</small></strong>}
        <dl>
          <div><dt>Protein</dt><dd>{round(totals.nutrition.protein)} g</dd></div>
          <div><dt>Carbs</dt><dd>{round(totals.nutrition.carbs)} g</dd></div>
          <div><dt>Fat</dt><dd>{round(totals.nutrition.fat)} g</dd></div>
          <div><dt>Weight</dt><dd>{totals.grams} g</dd></div>
        </dl>
      </section>

      <section className="meal-photo-scale" aria-label="Portion size">
        <span className="eyebrow">How big was your portion?</span>
        <div className="segmented three" role="group">
          {portionScales.map((option) => <button key={option.id} type="button" className={scale === option.id ? "active" : ""} aria-pressed={scale === option.id} onClick={() => applyScale(option.id)}>{option.label}</button>)}
        </div>
      </section>

      <section className="meal-photo-items" aria-label="Foods found in the photo">
        <div className="detail-section-heading"><div><h3>Foods on the plate</h3><span>{totals.count} of {items.length} included</span></div><button type="button" className="text-button" onClick={addItem}><Plus size={15} />Add food</button></div>
        {items.map((item) => <div key={item.id} className={`meal-photo-item ${item.included ? "" : "excluded"}`}>
          <label className="meal-photo-item-toggle"><input type="checkbox" checked={item.included} onChange={() => toggle(item.id)} /><span className="visually-hidden">Include {item.name || "this food"}</span></label>
          <div className="meal-photo-item-copy">
            <ClearableInput value={item.name} onChange={(event) => rename(item.id, event.target.value)} onClear={() => rename(item.id, "")} maxLength={120} placeholder="Food name" clearLabel="Clear food name" />
            <small>{item.portion}</small>
          </div>
          <div className="meal-photo-item-fields">
            <label className="meal-photo-item-field"><span>Grams</span><NumericInput min="1" step="5" value={String(item.grams)} onChange={(event) => setGrams(item.id, Number(event.target.value))} /></label>
            {!hideCalories && <label className="meal-photo-item-field"><span>kcal</span><NumericInput min="0" step="5" value={String(Math.round(item.nutrition.calories))} onChange={(event) => setCalories(item.id, Number(event.target.value))} /></label>}
          </div>
          <button type="button" className="icon-button ghost meal-photo-item-remove" onClick={() => removeItem(item.id)} aria-label={`Remove ${item.name || "this food"}`}><Trash2 size={17} /></button>
        </div>)}
        {!items.length && <p className="detail-empty">Nothing left. Add a food, or take another photo.</p>}
      </section>

      <section className="meal-photo-hint" aria-label="Improve the estimate">
        <span className="eyebrow">Something the photo misses?</span>
        <ClearableInput value={hint} onChange={(event) => setHint(event.target.value)} onClear={() => setHint("")} maxLength={280} placeholder="e.g. fried in two tablespoons of olive oil" clearLabel="Clear detail" />
        <button type="button" className="secondary-button" disabled={!hint.trim()} onClick={() => onReanalyze(hint.trim())}><Sparkles size={16} />Estimate again</button>
      </section>

      <div className="meal-photo-where">
        <fieldset className="meal-photo-meal-type">
          <legend>Add to</legend>
          <div className="segmented four" role="group">
            {(Object.keys(mealLabels) as MealType[]).map((type) => <button key={type} type="button" className={mealType === type ? "active" : ""} aria-pressed={mealType === type} onClick={() => setMealType(type)}>{mealLabels[type]}</button>)}
          </div>
        </fieldset>
        <DatePickerField className="meal-photo-date" label="Date" value={loggedDate} required onChange={setLoggedDate} />
      </div>

      {error && <div className="inline-alert error" role="alert"><Info size={17} /><span>{error}</span></div>}
      <div className="sheet-actions">
        <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
        <button type="submit" className="primary-button"><Check size={17} />{hideCalories ? "Log meal" : `Log ${Math.round(totals.nutrition.calories)} kcal`}</button>
      </div>
      <p className="photo-disclaimer">Saved as an estimate. The photo is stored privately with the entry.</p>
    </form>
  </div>;
}
