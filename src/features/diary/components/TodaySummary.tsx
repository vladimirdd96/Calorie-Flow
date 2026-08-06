"use client";

import { ChevronDown, Drumstick, Droplet, Leaf, Wheat } from "lucide-react";
import { type CSSProperties, type ReactNode, useState } from "react";
import { netCarbs, round } from "@/lib/nutrition";
import type { DailyTargets, Micronutrients, Nutrition, Profile } from "@/lib/types";
import { ConfigShortcut } from "@/features/shared/ConfigShortcut";
import { ProgressRing } from "./DiaryPrimitives";

const microLabels: Array<{ key: keyof Micronutrients; label: string; unit: string; group: "mineral" | "vitamin" }> = [
  { key: "sodiumMg", label: "Sodium", unit: "mg", group: "mineral" },
  { key: "potassiumMg", label: "Potassium", unit: "mg", group: "mineral" },
  { key: "calciumMg", label: "Calcium", unit: "mg", group: "mineral" },
  { key: "ironMg", label: "Iron", unit: "mg", group: "mineral" },
  { key: "magnesiumMg", label: "Magnesium", unit: "mg", group: "mineral" },
  { key: "zincMg", label: "Zinc", unit: "mg", group: "mineral" },
  { key: "cholesterolMg", label: "Cholesterol", unit: "mg", group: "mineral" },
  { key: "saturatedFatG", label: "Saturated fat", unit: "g", group: "mineral" },
  { key: "vitaminAMcg", label: "Vitamin A", unit: "mcg", group: "vitamin" },
  { key: "vitaminCMg", label: "Vitamin C", unit: "mg", group: "vitamin" },
  { key: "vitaminDMcg", label: "Vitamin D", unit: "mcg", group: "vitamin" },
  { key: "vitaminEMg", label: "Vitamin E", unit: "mg", group: "vitamin" },
  { key: "vitaminKMcg", label: "Vitamin K", unit: "mcg", group: "vitamin" },
  { key: "vitaminB12Mcg", label: "Vitamin B12", unit: "mcg", group: "vitamin" },
  { key: "folateMcg", label: "Folate", unit: "mcg", group: "vitamin" },
];

function MacroTarget({ icon, label, value, target, color }: { icon: ReactNode; label: string; value: number; target: number; color: string }) {
  return <div className="today-macro-row" style={{ "--macro-color": color } as CSSProperties}>
    <span className="today-macro-icon">{icon}</span>
    <div><div className="today-macro-label"><span>{label}</span><strong>{round(value)} / {target} g</strong></div><div className="today-progress"><i style={{ width: `${Math.min(100, value / Math.max(1, target) * 100)}%` }} /></div></div>
  </div>;
}

function NutritionExpanded({ total, profile }: { total: Nutrition; profile: Profile }) {
  const [microsOpen, setMicrosOpen] = useState(false);
  const macroCalories = total.protein * 4 + total.carbs * 4 + total.fat * 9;
  const shares = {
    protein: macroCalories ? Math.round(total.protein * 4 / macroCalories * 100) : 0,
    carbs: macroCalories ? Math.round(total.carbs * 4 / macroCalories * 100) : 0,
    fat: macroCalories ? Math.round(total.fat * 9 / macroCalories * 100) : 0,
  };
  const micros = total.micronutrients;
  const availableMicros = micros ? microLabels.map((item) => ({ ...item, value: micros[item.key] })) : [];
  const contextMetrics = [
    ["Sugar", total.sugar, profile.sugarTarget, "g", "var(--carbs)"],
    ["Saturated fat", micros?.saturatedFatG ?? 0, profile.saturatedFatTarget, "g", "var(--fat)"],
    ["Sodium", micros?.sodiumMg ?? 0, profile.sodiumTarget, "mg", "var(--blue)"],
    ["Potassium", micros?.potassiumMg ?? 0, profile.potassiumTarget, "mg", "var(--mint)"],
  ] as const;
  return <div className="today-nutrition-expanded">
    <div className="macro-share" aria-label={`${shares.protein}% protein, ${shares.carbs}% carbs, ${shares.fat}% fat`}><i className="protein" style={{ width: `${shares.protein}%` }} /><i className="carbs" style={{ width: `${shares.carbs}%` }} /><i className="fat" style={{ width: `${shares.fat}%` }} /></div>
    <div className="macro-share-labels" style={{ gridTemplateColumns: `${shares.protein}fr ${shares.carbs}fr ${shares.fat}fr` }}><span>{shares.protein}% protein</span><span>{shares.carbs}% carbs</span><span>{shares.fat}% fat</span></div>
    <div className="expanded-targets">
      {contextMetrics.map(([label, value, target, unit, color]) => <div key={label} style={{ "--macro-color": color } as CSSProperties}><div className="expanded-target-heading"><span>{label}</span><strong>{round(value, unit === "mg" ? 0 : 1)} {unit} <small>of {target} {unit} target</small></strong></div><div className="expanded-target-bar"><i /><span><b style={{ width: `${Math.min(100, value / Math.max(1, target) * 100)}%` }} /></span></div></div>)}
    </div>
    <button type="button" className="micros-toggle" aria-expanded={microsOpen} onClick={() => setMicrosOpen((open) => !open)}>Micronutrients ({availableMicros.length})<ChevronDown size={13} /></button>
    {microsOpen && <div className="micro-chip-groups">{(["mineral", "vitamin"] as const).map((group) => <section key={group}><span>{group === "mineral" ? "Minerals & other" : "Vitamins"}</span><div>{availableMicros.filter((item) => item.group === group).map((item) => <span className={item.value === 0 ? "zero" : ""} key={item.key}><strong>{round(item.value, 2)}</strong>{item.unit} {item.label}</span>)}</div></section>)}</div>}
  </div>;
}

export function TodaySummary({ profile, total, targets, onOpenTargets, dateNav }: { profile: Profile; total: Nutrition; targets: DailyTargets; onOpenTargets: () => void; dateNav?: ReactNode }) {
  const [nutritionOpen, setNutritionOpen] = useState(false);
  const carbs = profile.carbDisplay === "net" ? netCarbs(total) : total.carbs;
  const remaining = profile.hideCalories ? targets.protein - total.protein : targets.calories - total.calories;
  return <section className="today-hero card">
    {dateNav && <div className="today-hero-date">{dateNav}</div>}
    <ConfigShortcut label="Edit daily targets" onClick={onOpenTargets} />
    <div className="today-hero-main">
      <ProgressRing value={profile.hideCalories ? total.protein : total.calories} target={profile.hideCalories ? targets.protein : targets.calories} nutrition={total} centerValue={Math.abs(Math.round(remaining))} centerUnit={profile.hideCalories ? "g protein left" : remaining < 0 ? "kcal over" : "kcal left"} centerSub={profile.hideCalories ? `${round(total.protein)} of ${targets.protein} g eaten` : `${Math.round(total.calories)} of ${targets.calories} eaten`} centerColor={remaining < 0 ? "var(--fat)" : "var(--text)"} hideLegend />
      <div className="today-macros"><span className="eyebrow">Today&apos;s macros</span><MacroTarget icon={<Drumstick />} label="Protein" value={total.protein} target={targets.protein} color="var(--protein)" /><MacroTarget icon={<Wheat />} label={profile.carbDisplay === "net" ? "Net carbs" : "Carbs"} value={carbs} target={targets.carbs} color="var(--carbs)" /><MacroTarget icon={<Droplet />} label="Fat" value={total.fat} target={targets.fat} color="var(--fat)" /><MacroTarget icon={<Leaf />} label="Fibre" value={total.fiber} target={targets.fiber} color="var(--blue)" /></div>
    </div>
    <div className="today-nutrition-divider" />
    <button type="button" className="today-nutrition-toggle" aria-expanded={nutritionOpen} onClick={() => setNutritionOpen((open) => !open)}>Full nutrition details<ChevronDown size={14} /></button>
    {nutritionOpen && <NutritionExpanded total={total} profile={profile} />}
  </section>;
}
