"use client";

import { ArrowLeft, ChevronRight, Info, Package, Plus, Sparkles } from "lucide-react";
import { type FormEvent, useState } from "react";
import { ThemedSelect } from "@/features/shared/ThemedSelect";
import { NumericInput } from "@/features/shared/NumericInput";
import { ClearableInput } from "@/features/shared/ClearableInput";
import { contextualUnits, formatUnit, gramsFor, localDateKey, round, scaleNutrition, suggestedMealType } from "@/lib/nutrition";
import { recentLogDates } from "@/lib/logging";
import type { Food, Meal, MealType, Nutrition, ServingUnit } from "@/lib/types";

const mealLabels: Record<MealType, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };
const unitLabels: Record<ServingUnit, string> = { serving: "Serving", g: "Grams", "100g": "100 g", package: "Package", piece: "Piece", tbsp: "Tbsp", tsp: "Tsp", ml: "ml" };
function dayLabel(dateKey: string) { const today = localDateKey(); if (dateKey === today) return "Today"; const date = new Date(`${dateKey}T12:00:00`); const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); if (dateKey === localDateKey(yesterday)) return "Yesterday"; return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); }
function FoodAvatar({ food, name }: { food?: Food; name?: string }) { if (food?.imageUrl) return <img className="food-avatar" src={food.imageUrl} alt="" />; return <div className="food-avatar fallback">{(name || food?.name || "F").slice(0, 1).toUpperCase()}</div>; }

export function FoodRow({ food, onSelect, hideCalories = false }: { food: Food; onSelect: () => void; hideCalories?: boolean }) {
  const detail = food.brand || (food.source === "custom" ? "Your custom food" : food.source === "seed" ? food.servingLabel || "Reference food" : food.source === "food-data-central" ? "USDA FoodData Central" : food.source === "restaurant" ? "Restaurant menu" : "Saved food");
  return (
    <button className="food-row" onClick={onSelect}>
      <FoodAvatar food={food} />
      <span className="food-copy"><strong>{food.name}</strong><small>{detail}</small></span>
      {!hideCalories && <span className="food-calories"><strong>{Math.round(food.nutrientsPer100.calories)}</strong><small>kcal / 100 g</small></span>}
      <ChevronRight size={18} />
    </button>
  );
}

export function ManualFood({ initialBarcode, notice, onSave, onClose, hideCalories }: { initialBarcode?: string; notice?: string; onSave: (food: Food) => void; onClose: () => void; hideCalories: boolean }) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [barcode, setBarcode] = useState(initialBarcode || "");
  const [servingGrams, setServingGrams] = useState(100);
  const [nutrition, setNutrition] = useState<Nutrition>({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 });
  const [error, setError] = useState("");
  const updateNutrition = (key: keyof Nutrition, value: string) => setNutrition((current) => ({ ...current, [key]: Number(value) }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const calories = hideCalories ? round(nutrition.protein * 4 + nutrition.carbs * 4 + nutrition.fat * 9, 0) : nutrition.calories;
    const values = [nutrition.protein, nutrition.carbs, nutrition.fat, nutrition.fiber, nutrition.sugar, calories, servingGrams];
    if (!name.trim() || values.some((value) => !Number.isFinite(value) || value < 0) || servingGrams <= 0) {
      setError("Add a food name and use zero or positive nutrition values with a serving above zero.");
      return;
    }
    setError("");
    onSave({ id: `custom-${crypto.randomUUID()}`, name: name.trim(), brand: brand.trim() || undefined, barcode: barcode.trim() || undefined, servingGrams, nutrientsPer100: { ...nutrition, calories }, source: "custom" });
  };
  return (
    <form className="sheet-form manual-food-form" onSubmit={submit}>
      <div className="sheet-header"><button type="button" className="icon-button ghost" onClick={onClose} aria-label="Back to add food options"><ArrowLeft /></button><div><span className="eyebrow">Full control</span><h2>Custom food</h2></div><span /></div>
      {notice && <div className="inline-alert" role="status"><Info size={17} /><span>{notice}</span></div>}
      <div className="form-grid two"><label className="span-two"><span>Food name</span><ClearableInput autoFocus required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} onClear={() => setName("")} placeholder="e.g. Homemade meatballs" clearLabel="Clear food name" /></label><label><span>Brand <small>optional</small></span><ClearableInput maxLength={120} value={brand} onChange={(event) => setBrand(event.target.value)} onClear={() => setBrand("")} placeholder="e.g. Acme" clearLabel="Clear brand" /></label><label><span>Barcode <small>optional</small></span><ClearableInput inputMode="numeric" maxLength={80} value={barcode} onChange={(event) => setBarcode(event.target.value)} onClear={() => setBarcode("")} placeholder="e.g. 3800123456789" clearLabel="Clear barcode" /></label></div>
      <div className="nutrition-entry"><div className="entry-heading"><div><strong>Nutrition per 100 g</strong><small>{hideCalories ? "Energy is calculated quietly from macros" : "Copy the package values"}</small></div><Package size={20} /></div><div className="form-grid three">{!hideCalories && <label><span>Calories</span><NumericInput required min="0" inputMode="decimal" value={nutrition.calories} onChange={(event) => updateNutrition("calories", event.target.value)} /></label>}<label><span>Protein</span><NumericInput min="0" inputMode="decimal" step="0.1" value={nutrition.protein} onChange={(event) => updateNutrition("protein", event.target.value)} /></label><label><span>Carbs</span><NumericInput min="0" inputMode="decimal" step="0.1" value={nutrition.carbs} onChange={(event) => updateNutrition("carbs", event.target.value)} /></label><label><span>Fat</span><NumericInput min="0" inputMode="decimal" step="0.1" value={nutrition.fat} onChange={(event) => updateNutrition("fat", event.target.value)} /></label><label><span>Fibre</span><NumericInput min="0" inputMode="decimal" step="0.1" value={nutrition.fiber} onChange={(event) => updateNutrition("fiber", event.target.value)} /></label><label><span>Sugar</span><NumericInput min="0" inputMode="decimal" step="0.1" value={nutrition.sugar} onChange={(event) => updateNutrition("sugar", event.target.value)} /></label></div></div>
      <label><span>Default serving weight</span><div className="input-suffix"><NumericInput required inputMode="decimal" min="0.1" step="0.1" value={servingGrams} onChange={(event) => setServingGrams(Number(event.target.value))} /><span>g</span></div></label>
      {error && <div className="inline-alert error" role="alert"><Info size={17} /><span>{error}</span></div>}
      <button className="primary-button full" type="submit">Continue to amount<ChevronRight size={18} /></button>
    </form>
  );
}

export function PortionSheet({ food, questions, initialMealType, onLog, onClose, hideCalories }: { food: Food; questions?: string[]; initialMealType?: MealType; onLog: (meal: Meal, food: Food) => void; onClose: () => void; hideCalories: boolean }) {
  const units = contextualUnits(food);
  const initialUnit: ServingUnit = food.packageGrams ? "package" : food.servingGrams ? "serving" : "g";
  const [unit, setUnit] = useState<ServingUnit>(initialUnit);
  const [amount, setAmount] = useState(initialUnit === "g" ? 100 : 1);
  const [mealType, setMealType] = useState<MealType>(() => initialMealType || suggestedMealType());
  const [loggedDate, setLoggedDate] = useState(localDateKey());
  const [additionalDatesOpen, setAdditionalDatesOpen] = useState(false);
  const [loggedDates, setLoggedDates] = useState<string[]>([localDateKey()]);
  const grams = gramsFor(food, amount, unit);
  const nutrition = scaleNutrition(food.nutrientsPer100, grams);
  const log = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(grams) || grams <= 0) return;
    const dates = additionalDatesOpen ? loggedDates : [loggedDate];
    dates.forEach((date) => onLog({
      id: crypto.randomUUID(), foodId: food.id, name: food.name, brand: food.brand, mealType, amount, unit, grams, nutrition,
      createdAt: new Date().toISOString(), loggedDate: date, source: food.source, estimated: food.source === "ai-label" || !food.verified,
    }, { ...food, lastUsedAt: new Date().toISOString() }));
  };
  return (
    <form className="portion-sheet" onSubmit={log}>
      <div className="sheet-header"><button type="button" className="icon-button ghost" onClick={onClose} aria-label="Back to food selection"><ArrowLeft /></button><div><span className="eyebrow">Confirm amount</span><h2>Log food</h2></div><span /></div>
      <div className="selected-food"><FoodAvatar food={food} /><div><strong>{food.name}</strong><span>{food.brand || food.quantityLabel || "Nutrition per 100 g"}</span></div>{!hideCalories && <div className="selected-calories"><strong>{nutrition.calories}</strong><small>kcal</small></div>}</div>
      {!!questions?.length && <div className="follow-up"><Sparkles size={18} /><div><strong>One detail still matters</strong>{questions.map((question) => <p key={question}>{question}</p>)}<small>Use grams below if the package or serving amount is unknown.</small></div></div>}
      <div className="amount-control"><button type="button" aria-label="Decrease amount" onClick={() => setAmount(Math.max(unit === "g" ? 1 : 0.25, round(amount - (unit === "g" || unit === "ml" ? 10 : 0.5), 2)))}>−</button><label><NumericInput required aria-label="Amount" inputMode="decimal" min="0.01" step="any" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /><span>{formatUnit(unit, amount)}</span></label><button type="button" aria-label="Increase amount" onClick={() => setAmount(round(amount + (unit === "g" || unit === "ml" ? 10 : 0.5), 2))}>+</button></div>
      <div className="unit-scroll" role="group" aria-label="Serving unit">{units.map((option) => <button type="button" key={option} aria-pressed={unit === option} className={unit === option ? "active" : ""} onClick={() => { setUnit(option); setAmount(option === "g" || option === "ml" ? 100 : 1); }}>{unitLabels[option]}</button>)}</div>
      {(unit === "tbsp" || unit === "tsp" || unit === "ml") && <p className="estimate-note"><Info size={14} /> Volume-to-weight conversion is approximate unless the food provides it.</p>}
      <div className="nutrition-preview"><div><span>Protein</span><strong>{nutrition.protein} g</strong></div><div><span>Carbs</span><strong>{nutrition.carbs} g</strong></div><div><span>Fat</span><strong>{nutrition.fat} g</strong></div><div><span>Fibre</span><strong>{nutrition.fiber} g</strong></div></div>
      <div className="portion-action-area">
        <div className="field-block"><span id="meal-type-label">Add to</span><div className="segmented four" role="group" aria-labelledby="meal-type-label">{(Object.keys(mealLabels) as MealType[]).map((type) => <button type="button" key={type} aria-pressed={mealType === type} className={mealType === type ? "active" : ""} onClick={() => setMealType(type)}>{mealLabels[type]}</button>)}</div></div>
      <label className="meal-date-field"><span>Meal date <small>Usually today</small></span><input type="date" value={loggedDate} max={localDateKey()} onChange={(event) => setLoggedDate(event.target.value || localDateKey())} /></label>
      <div className="multi-date-log"><button type="button" className="text-button" aria-expanded={additionalDatesOpen} onClick={() => setAdditionalDatesOpen((open) => !open)}>{additionalDatesOpen ? "Log one day instead" : "Log this on multiple days"}</button>{additionalDatesOpen && <div className="multi-date-options" role="group" aria-label="Days to log this food">{recentLogDates().map((date) => <button type="button" key={date} className={loggedDates.includes(date) ? "active" : ""} aria-pressed={loggedDates.includes(date)} onClick={() => setLoggedDates((current) => current.includes(date) ? current.filter((item) => item !== date) : [...current, date])}>{dayLabel(date)}</button>)}</div>}</div>
      <div className="portion-submit"><button className="primary-button full" type="submit" disabled={additionalDatesOpen && loggedDates.length === 0}><Plus size={18} />{hideCalories ? "Log food" : `Log ${nutrition.calories} kcal`}</button><p className="form-footnote">{grams} g total · {food.source === "open-food-facts" ? "Open Food Facts" : food.source === "food-data-central" ? "USDA FoodData Central" : food.source === "restaurant" ? "Restaurant menu nutrition" : food.source === "ai-label" ? "AI-extracted—check the package" : food.source === "custom" ? "Your custom food" : "Generic reference value"}</p></div>
      </div>
    </form>
  );
}

export function QuickMacroSheet({ onLog, onClose, hideCalories }: { onLog: (meal: Meal, food: Food) => void; onClose: () => void; hideCalories: boolean }) {
  const [name, setName] = useState(""); const [mealType, setMealType] = useState<MealType>(suggestedMealType()); const [date, setDate] = useState(localDateKey()); const [values, setValues] = useState({ protein: "", carbs: "", fat: "", fiber: "", sugar: "" });
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const nutrients = { protein: Number(values.protein), carbs: Number(values.carbs), fat: Number(values.fat), fiber: Number(values.fiber), sugar: Number(values.sugar) }; if (!name.trim() || Object.values(nutrients).some((value) => !Number.isFinite(value) || value < 0)) return; const nutrition: Nutrition = { ...nutrients, calories: round(nutrients.protein * 4 + nutrients.carbs * 4 + nutrients.fat * 9, 0) }; const food: Food = { id: `quick-${crypto.randomUUID()}`, name: name.trim(), servingGrams: 100, nutrientsPer100: nutrition, source: "custom" }; onLog({ id: crypto.randomUUID(), foodId: food.id, name: food.name, mealType, amount: 1, unit: "serving", grams: 100, nutrition, createdAt: new Date().toISOString(), loggedDate: date, source: "custom" }, food); };
  return <form className="sheet-form quick-macro-sheet" onSubmit={submit}><div className="sheet-header"><button type="button" className="icon-button ghost" onClick={onClose} aria-label="Back to add food options"><ArrowLeft /></button><div><span className="eyebrow">Fast entry</span><h2>Quick macros</h2></div><span /></div><label><span>Name</span><ClearableInput required value={name} maxLength={120} onChange={(event) => setName(event.target.value)} onClear={() => setName("")} placeholder="e.g. Protein shake" clearLabel="Clear macro name" /></label><div className="form-grid three">{(["protein", "carbs", "fat", "fiber", "sugar"] as const).map((key) => <label key={key}><span>{key === "fiber" ? "Fibre" : key[0].toUpperCase() + key.slice(1)} g</span><NumericInput min="0" step="0.1" value={values[key]} placeholder="0" onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} /></label>)}</div>{!hideCalories && <p className="form-footnote">Calories are calculated from the macros you enter.</p>}<div className="form-grid two"><label><span>Meal</span><ThemedSelect ariaLabel="Quick macro meal" value={mealType} onChange={(value) => setMealType(value as MealType)} options={(Object.keys(mealLabels) as MealType[]).map((type) => ({ value: type, label: mealLabels[type] }))} /></label><label><span>Date</span><input type="date" max={localDateKey()} value={date} onChange={(event) => setDate(event.target.value)} /></label></div><button className="primary-button full" type="submit"><Plus size={18} />Log macros</button></form>;
}
