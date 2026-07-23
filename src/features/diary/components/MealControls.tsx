"use client";

import { ArrowRightLeft, Check, ChevronRight, Copy, GripVertical, ImagePlus, Info, MoreHorizontal, Pencil, Trash2, Utensils } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { ThemedSelect } from "@/features/shared/ThemedSelect";
import { NumericInput } from "@/features/shared/NumericInput";
import { formatUnit, round } from "@/lib/nutrition";
import type { Meal, MealType } from "@/lib/types";
import { mealLabels, readMealImage } from "./DiaryPrimitives";

export function MealRow({ meal, imageUrl, onDelete, onEdit, onDuplicate, onMove, onDetails, onOpenImage, onDragStart, onDragOver, onDrop, onPointerDown, dropPosition, dragging, hideCalories }: { meal: Meal; imageUrl?: string; onDelete: () => void; onEdit: () => void; onDuplicate: () => void; onMove: () => void; onDetails: () => void; onOpenImage: () => void; onDragStart: (meal: Meal, event: React.DragEvent<HTMLDivElement>) => void; onDragOver: (event: React.DragEvent<HTMLDivElement>) => void; onDrop: (event: React.DragEvent<HTMLDivElement>) => void; onPointerDown: (meal: Meal, event: React.PointerEvent<HTMLButtonElement>) => void; dropPosition?: "before" | "after"; dragging?: boolean; hideCalories: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", closeOnEscape); };
  }, [menuOpen]);
  return (
    <div className={`meal-row ${dropPosition ? `drop-${dropPosition}` : ""}${dragging ? " dragging" : ""}`} draggable onDragStart={(event) => onDragStart(meal, event)} onDragOver={onDragOver} onDrop={onDrop} data-meal-id={meal.id} data-meal-type={meal.mealType} title="Drag this meal to reorder it or move it to another meal section" aria-label={`Drag ${meal.name} to reorder it or move it to another meal section`}>
      <button type="button" className="meal-drag-handle" onPointerDown={(event) => onPointerDown(meal, event)} aria-label={`Hold and drag ${meal.name} to reorder it`}><GripVertical size={17} aria-hidden="true" /></button>
      {imageUrl ? <button type="button" className="meal-icon meal-image-trigger" onClick={onOpenImage} aria-label={`Expand photo for ${meal.name}`}><img src={imageUrl} alt="" /></button> : <div className="meal-icon"><Utensils size={17} /></div>}
      <button type="button" className="meal-detail-trigger" onClick={onDetails} aria-label={`View nutrition details for ${meal.name}`}><div className="meal-copy">
        <strong>{meal.name}</strong>
        <span>{meal.amount} {formatUnit(meal.unit, meal.amount)} · {new Date(meal.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · P {meal.nutrition.protein} · C {meal.nutrition.carbs} · F {meal.nutrition.fat}</span>
      </div></button>
      {!hideCalories && <strong className="meal-kcal"><span>{Math.round(meal.nutrition.calories)}</span><small>kcal</small></strong>}
      <span ref={menuRef} className="meal-actions"><button type="button" className="meal-menu-trigger" onClick={() => setMenuOpen((open) => !open)} aria-label={`Options for ${meal.name}`} aria-expanded={menuOpen}><MoreHorizontal size={18} /></button>{menuOpen && <span className="meal-action-menu" role="menu"><button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onMove(); }}><ArrowRightLeft size={14} />Move</button><button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onEdit(); }}><Pencil size={14} />Edit</button><button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onDuplicate(); }}><Copy size={14} />Duplicate</button><button type="button" role="menuitem" className="danger" onClick={() => { setMenuOpen(false); onDelete(); }}><Trash2 size={14} />Delete</button></span>}</span>
    </div>
  );
}

export function MoveMealSheet({ meal, onMove, onClose }: { meal: Meal; onMove: (mealType: MealType) => void; onClose: () => void }) {
  const [mealType, setMealType] = useState<MealType>(meal.mealType);
  return <div className="meal-editor duplicate-meal-sheet"><div className="sheet-header"><div><span className="eyebrow">Your diary</span><h2>Move meal</h2></div></div><div className="duplicate-meal-copy"><strong>{meal.name}</strong><p>Choose a meal section. On mobile, this is the quickest way to move food.</p></div><label className="meal-editor-form"><span>Move to</span><ThemedSelect ariaLabel="Move to" value={mealType} onChange={(value) => setMealType(value as MealType)} options={(Object.keys(mealLabels) as MealType[]).map((type) => ({ value: type, label: mealLabels[type] }))} /></label><div className="sheet-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="button" className="primary-button" onClick={() => onMove(mealType)}><ArrowRightLeft size={17} />Move meal</button></div></div>;
}

export function DuplicateMealSheet({ meal, onDuplicate, onClose }: { meal: Meal; onDuplicate: (mealType: MealType) => void; onClose: () => void }) {
  const [mealType, setMealType] = useState<MealType>(meal.mealType);
  return <div className="meal-editor duplicate-meal-sheet"><div className="sheet-header"><div><span className="eyebrow">Your diary</span><h2>Duplicate meal</h2></div></div><div className="duplicate-meal-copy"><strong>{meal.name}</strong><p>Choose where to add a copy. The original meal stays where it is.</p></div><label className="meal-editor-form"><span>Add copy to</span><ThemedSelect ariaLabel="Add copy to" value={mealType} onChange={(value) => setMealType(value as MealType)} options={(Object.keys(mealLabels) as MealType[]).map((type) => ({ value: type, label: mealLabels[type] }))} /></label><div className="sheet-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="button" className="primary-button" onClick={() => onDuplicate(mealType)}><Copy size={17} />Duplicate</button></div></div>;
}

export function MealEditor({ meal, onSave, onClose, hideCalories }: { meal: Meal; onSave: (meal: Meal) => void; onClose: () => void; hideCalories: boolean }) {
  const [name, setName] = useState(meal.name);
  const [amount, setAmount] = useState(String(meal.amount));
  const [mealType, setMealType] = useState<MealType>(meal.mealType);
  const [nutrition, setNutrition] = useState(() => ({
    calories: String(Math.round(meal.nutrition.calories)),
    protein: String(meal.nutrition.protein),
    carbs: String(meal.nutrition.carbs),
    fat: String(meal.nutrition.fat),
    fiber: String(meal.nutrition.fiber),
    sugar: String(meal.nutrition.sugar),
  }));
  const [error, setError] = useState("");
  const [imageUrl, setImageUrl] = useState(meal.imageUrl);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const updateNutrition = (key: keyof typeof nutrition, value: string) => setNutrition((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextAmount = Number(amount);
    const nextNutrition = Object.fromEntries(Object.entries(nutrition).map(([key, value]) => [key, Number(value)])) as Record<keyof typeof nutrition, number>;
    if (!name.trim() || !Number.isFinite(nextAmount) || nextAmount <= 0 || Object.values(nextNutrition).some((value) => !Number.isFinite(value) || value < 0)) {
      setError("Add a meal name, a positive amount, and zero or positive nutrition values.");
      return;
    }
    const ratio = meal.amount > 0 ? nextAmount / meal.amount : 1;
    onSave({ ...meal, name: name.trim(), amount: nextAmount, mealType, imageUrl, grams: round(meal.grams * ratio), nutrition: { ...meal.nutrition, ...nextNutrition, calories: Math.round(nextNutrition.calories) } });
  };
  const chooseImage = async (file: File | undefined) => {
    if (!file) return;
    try { setImageUrl(await readMealImage(file)); setError(""); }
    catch (imageError) { setError(imageError instanceof Error ? imageError.message : "The image could not be added."); }
  };
  return <div className="meal-editor">
    <div className="sheet-header"><div><span className="eyebrow">Your diary</span><h2 id="meal-editor-title">Edit meal</h2></div><span /></div>
    <form className="meal-editor-form" onSubmit={submit}>
      <label><span>Meal and additions</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={240} placeholder="e.g. Greek yoghurt and berries" /></label>
      <section className="meal-photo-editor" aria-labelledby="meal-photo-heading">
        <div><span className="eyebrow" id="meal-photo-heading">Meal photo</span><small>Optional. Stored privately with this diary entry.</small></div>
        {imageUrl ? <div className="meal-photo-preview"><img src={imageUrl} alt="Preview of this meal" /><div><strong>Photo added</strong><small>You can replace it or remove it below.</small><button type="button" className="secondary-button" onClick={() => imageInputRef.current?.click()}>Replace photo</button><button type="button" className="text-button muted" onClick={() => setImageUrl(undefined)}>Remove</button></div></div> : <button type="button" className="meal-photo-upload" onClick={() => imageInputRef.current?.click()}><span className="meal-photo-upload-icon"><ImagePlus size={19} /></span><span className="meal-photo-upload-copy"><strong>Add a meal photo</strong><small>Choose from your device</small></span><ChevronRight size={17} aria-hidden="true" /> </button>}
        <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={(event) => { void chooseImage(event.target.files?.[0]); event.target.value = ""; }} />
      </section>
      <div className="form-grid two"><label><span>Amount</span><NumericInput min="0.1" step="0.1" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label><span>Meal</span><ThemedSelect ariaLabel="Meal" value={mealType} onChange={(value) => setMealType(value as MealType)} options={(Object.keys(mealLabels) as MealType[]).map((type) => ({ value: type, label: mealLabels[type] }))} /></label></div>
      <section className="editor-nutrition" aria-labelledby="meal-nutrition-heading">
        <div className="editor-nutrition-heading"><div><span className="eyebrow" id="meal-nutrition-heading">Nutrition for this entry</span><small>Adjust what you actually ate.</small></div><Pencil size={17} aria-hidden="true" /></div>
        <div className="form-grid three editor-nutrition-fields">
          {!hideCalories && <label><span>Calories <small>kcal</small></span><NumericInput required min="0" step="1" inputMode="numeric" value={nutrition.calories} onChange={(event) => updateNutrition("calories", event.target.value)} /></label>}
          <label><span>Protein <small>g</small></span><NumericInput min="0" step="0.1" inputMode="decimal" value={nutrition.protein} onChange={(event) => updateNutrition("protein", event.target.value)} /></label>
          <label><span>Carbs <small>g</small></span><NumericInput min="0" step="0.1" inputMode="decimal" value={nutrition.carbs} onChange={(event) => updateNutrition("carbs", event.target.value)} /></label>
          <label><span>Fat <small>g</small></span><NumericInput min="0" step="0.1" inputMode="decimal" value={nutrition.fat} onChange={(event) => updateNutrition("fat", event.target.value)} /></label>
          <label><span>Fibre <small>g</small></span><NumericInput min="0" step="0.1" inputMode="decimal" value={nutrition.fiber} onChange={(event) => updateNutrition("fiber", event.target.value)} /></label>
          <label><span>Sugar <small>g</small></span><NumericInput min="0" step="0.1" inputMode="decimal" value={nutrition.sugar} onChange={(event) => updateNutrition("sugar", event.target.value)} /></label>
        </div>
      </section>
      {error && <div className="inline-alert error" role="alert"><Info size={16} />{error}</div>}
      <div className="sheet-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button"><Check size={17} />Save changes</button></div>
    </form>
  </div>;
}
