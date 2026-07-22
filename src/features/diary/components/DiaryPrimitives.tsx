"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { formatUnit, localDateKey, round } from "@/lib/nutrition";
import type { Food, MealType, Nutrition } from "@/lib/types";

const MAX_MEAL_IMAGE_DATA_URL_LENGTH = 360_000;
const MEAL_IMAGE_DIMENSIONS = [1024, 896, 768, 640];
const MEAL_IMAGE_QUALITIES = [0.78, 0.68, 0.58, 0.48];

export function BrandMark({ large = false }: { large?: boolean }) {
  return <img className={`brand-mark${large ? " large" : ""}`} src="/icon.svg" alt="" aria-hidden="true" />;
}

export const mealLabels: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export function dayLabel(dateKey: string) {
  const today = localDateKey();
  if (dateKey === today) return "Today";
  const date = new Date(`${dateKey}T12:00:00`);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateKey === localDateKey(yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function changeDate(dateKey: string, amount: number) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return localDateKey(date);
}

export function ProgressRing({ value, target, nutrition }: { value: number; target: number; nutrition: Nutrition }) {
  const [activeSegment, setActiveSegment] = useState<string>();
  const progress = Math.min(1, value / Math.max(1, target));
  const circumference = 2 * Math.PI * 82;
  const macroSegments = [
    { label: "Protein", grams: nutrition.protein, value: nutrition.protein * 4, color: "var(--protein)" },
    { label: "Carbs", grams: nutrition.carbs, value: nutrition.carbs * 4, color: "var(--carbs)" },
    { label: "Fat", grams: nutrition.fat, value: nutrition.fat * 9, color: "var(--fat)" },
  ];
  const macroCalories = macroSegments.reduce((sum, segment) => sum + segment.value, 0);
  const selectedSegment = macroSegments.find((segment) => segment.label === activeSegment);
  let consumedOffset = 0;
  return (
    <div className="progress-ring" role="progressbar" aria-label={`Daily calorie progress. Protein ${round(nutrition.protein)} grams, carbs ${round(nutrition.carbs)} grams, fat ${round(nutrition.fat)} grams.`} aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.round(value)} aria-valuetext={`${Math.round(progress * 100)} percent of daily calories`}>
      <svg viewBox="0 0 200 200" role="img" aria-label="Macro calorie composition">
        <circle className="ring-track" cx="100" cy="100" r="82" />
        {macroSegments.map((segment) => {
          const share = macroCalories > 0 ? segment.value / macroCalories : 0;
          const length = circumference * progress * share;
          const offset = circumference * progress * consumedOffset;
          consumedOffset += share;
          const percentOfTarget = Math.round((segment.value / Math.max(1, target)) * 100);
          return <circle key={segment.label} className={`ring-segment${activeSegment === segment.label ? " active" : ""}`} cx="100" cy="100" r="82" stroke={segment.color} strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} tabIndex={0} role="img" aria-label={`${segment.label}: ${round(segment.grams)} grams, ${Math.round(segment.value)} calories, ${percentOfTarget}% of daily target`} onMouseEnter={() => setActiveSegment(segment.label)} onMouseLeave={() => setActiveSegment(undefined)} onFocus={() => setActiveSegment(segment.label)} onBlur={() => setActiveSegment(undefined)} />;
        })}
      </svg>
      {selectedSegment && <div className="ring-tooltip" role="status"><strong>{selectedSegment.label}</strong><span>{round(selectedSegment.grams)} g · {Math.round(selectedSegment.value)} kcal</span><small>{Math.round((selectedSegment.value / Math.max(1, target)) * 100)}% of daily target</small></div>}
      <div className="ring-content">
        <span className="eyebrow">Eaten</span>
        <strong>{Math.round(value).toLocaleString()}</strong>
        <span>of {target.toLocaleString()} kcal</span>
      </div>
      <div className="ring-legend" aria-hidden="true">
        {macroSegments.map((segment) => <span key={segment.label}><i style={{ background: segment.color }} />{segment.label}</span>)}
      </div>
    </div>
  );
}

export function MiniProgressRing({ value, target, label }: { value: number; target: number; label: string }) {
  const progress = Math.min(1, value / Math.max(1, target));
  return <span className="mini-progress-ring" style={{ "--progress": `${progress * 100}%` } as React.CSSProperties} aria-label={label} />;
}

function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const progress = Math.min(100, (value / Math.max(1, target)) * 100);
  return (
    <div className="macro-row">
      <div className="macro-label"><span>{label}</span><strong>{round(value, 0)} <small>/ {target} g</small></strong></div>
      <div className="bar-track" role="progressbar" aria-label={`${label}: ${round(value, 0)} of ${target} grams`} aria-valuemin={0} aria-valuemax={target} aria-valuenow={round(value, 0)}><div className="bar-fill" style={{ width: `${progress}%`, background: color }} /></div>
    </div>
  );
}

function FoodAvatar({ food, name }: { food?: Food; name?: string }) {
  if (food?.imageUrl) return <img className="food-avatar" src={food.imageUrl} alt="" />;
  return <div className="food-avatar fallback">{(name || food?.name || "F").slice(0, 1).toUpperCase()}</div>;
}

export async function readMealImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 8_000_000) throw new Error("That image is too large. Choose one under 8 MB.");
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("The image could not be read."));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new window.Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("The image could not be opened."));
    element.src = source;
  });
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  if (!longestSide) throw new Error("The image could not be opened.");

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The image could not be prepared.");

  // Try progressively smaller encodings so ordinary phone photos fit the
  // local recipe schema without asking the user to understand the limit.
  for (const maxDimension of MEAL_IMAGE_DIMENSIONS) {
    const scale = Math.min(1, maxDimension / longestSide);
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of MEAL_IMAGE_QUALITIES) {
      const encoded = canvas.toDataURL("image/jpeg", quality);
      if (encoded.length <= MAX_MEAL_IMAGE_DATA_URL_LENGTH) return encoded;
    }
  }

  throw new Error("That photo could not be added. Try another photo.");
}
