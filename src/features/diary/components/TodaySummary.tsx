"use client";

import { ChevronDown, ChevronRight, Drumstick, Droplet, Leaf, Scale, Timer, Wheat } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import { activeFast, eatingSessions, fastingWindowHours } from "@/lib/fasting";
import { hydrationTotal, setWaterAmount } from "@/lib/hydration";
import { netCarbs, round } from "@/lib/nutrition";
import type { DailyTargets, Meal, Micronutrients, Nutrition, Profile } from "@/lib/types";
import { ProgressRing } from "./DiaryPrimitives";

const fastingGoals = [12, 14, 16, 18] as const;
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

function FastingPanel({ profile, meals, onSave }: { profile: Profile; meals: Meal[]; onSave: (profile: Profile) => void }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const record = activeFast(profile.fastingRecords);
  const sessions = eatingSessions(profile, meals);
  const latestSession = sessions.at(-1);
  const startedAt = record?.startedAt || latestSession?.endedAt;
  const elapsed = startedAt ? fastingWindowHours(startedAt, now.toISOString()) : 0;
  const goal = profile.fastingGoalHours || 16;
  const sessionCopy = sessions.length
    ? `${sessions.length} eating session${sessions.length === 1 ? "" : "s"} logged today.`
    : "Your eating sessions will appear here after you log food.";
  return <div className="today-inline-panel">
    <div className="today-panel-heading"><strong>Fasting since {startedAt ? new Date(startedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "your last meal"}</strong><span>{round(elapsed)} / {goal} h</span></div>
    <div className="today-panel-progress"><i style={{ width: `${Math.min(100, elapsed / goal * 100)}%` }} /></div>
    <span className="today-panel-label">Goal</span>
    <div className="today-goal-options">{fastingGoals.map((hours) => <button key={hours} type="button" className={goal === hours ? "active" : ""} onClick={() => onSave({ ...profile, fastingGoalHours: hours })}>{hours} h</button>)}</div>
    <small>{sessionCopy}</small>
  </div>;
}

function WeightPanel({ profile, onSave, onOpenWeight }: { profile: Profile; onSave: (profile: Profile) => void; onOpenWeight: () => void }) {
  const latest = [...(profile.weightEntries || [])].sort((a, b) => b.date.localeCompare(a.date))[0]?.weightKg || profile.weightKg;
  const [draft, setDraft] = useState(String(round(latest)));
  const save = () => {
    const weightKg = Number(draft);
    if (!Number.isFinite(weightKg) || weightKg <= 0) return;
    const date = new Date().toISOString().slice(0, 10);
    onSave({ ...profile, weightKg, weightEntries: [...(profile.weightEntries || []).filter((entry) => entry.date !== date), { date, weightKg }] });
  };
  return <div className="today-inline-panel">
    <strong className="today-panel-title">Today&apos;s weigh-in</strong>
    <div className="today-weigh-row"><label><span className="visually-hidden">Weight in kilograms</span><input inputMode="decimal" value={draft} onChange={(event) => setDraft(event.target.value)} /><small>kg</small></label><button type="button" className="primary-button" onClick={save}>Save</button></div>
    <button type="button" className="today-trend-link" onClick={onOpenWeight}>See your trend<ChevronRight size={14} /></button>
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

export function TodaySummary({ profile, meals, total, targets, onSaveProfile, onOpenWeight }: { profile: Profile; meals: Meal[]; total: Nutrition; targets: DailyTargets; onSaveProfile: (profile: Profile) => void; onOpenWeight: () => void }) {
  const [openPanel, setOpenPanel] = useState<"fasting" | "weight">();
  const [nutritionOpen, setNutritionOpen] = useState(false);
  const carbs = profile.carbDisplay === "net" ? netCarbs(total) : total.carbs;
  const remaining = profile.hideCalories ? targets.protein - total.protein : targets.calories - total.calories;
  const latestWeight = [...(profile.weightEntries || [])].sort((a, b) => b.date.localeCompare(a.date))[0]?.weightKg || profile.weightKg;
  const fast = activeFast(profile.fastingRecords);
  const fastingHours = fast ? fastingWindowHours(fast.startedAt, new Date().toISOString()) : 0;
  return <section className="today-hero card">
    <div className="today-hero-toggles">
      {profile.enabledHabitFeatures?.includes("fasting") && <button type="button" className="fasting" aria-expanded={openPanel === "fasting"} onClick={() => setOpenPanel((open) => open === "fasting" ? undefined : "fasting")}><Timer size={13} />{fast ? `${round(fastingHours)}h fasted` : "Fasting since…"}</button>}
      {profile.weightTracking === "enabled" && <button type="button" className="weight" aria-expanded={openPanel === "weight"} onClick={() => setOpenPanel((open) => open === "weight" ? undefined : "weight")}><Scale size={13} />{round(latestWeight)} kg</button>}
    </div>
    {openPanel === "fasting" && <FastingPanel profile={profile} meals={meals} onSave={onSaveProfile} />}
    {openPanel === "weight" && <WeightPanel profile={profile} onSave={onSaveProfile} onOpenWeight={onOpenWeight} />}
    <div className="today-hero-main">
      <ProgressRing value={profile.hideCalories ? total.protein : total.calories} target={profile.hideCalories ? targets.protein : targets.calories} nutrition={total} centerValue={Math.abs(Math.round(remaining))} centerUnit={profile.hideCalories ? "g protein left" : remaining < 0 ? "kcal over" : "kcal left"} centerSub={profile.hideCalories ? `${round(total.protein)} of ${targets.protein} g eaten` : `${Math.round(total.calories)} of ${targets.calories} eaten`} centerColor={remaining < 0 ? "var(--fat)" : "var(--text)"} hideLegend />
      <div className="today-macros"><span className="eyebrow">Today&apos;s macros</span><MacroTarget icon={<Drumstick />} label="Protein" value={total.protein} target={targets.protein} color="var(--protein)" /><MacroTarget icon={<Wheat />} label={profile.carbDisplay === "net" ? "Net carbs" : "Carbs"} value={carbs} target={targets.carbs} color="var(--carbs)" /><MacroTarget icon={<Droplet />} label="Fat" value={total.fat} target={targets.fat} color="var(--fat)" /><MacroTarget icon={<Leaf />} label="Fibre" value={total.fiber} target={targets.fiber} color="var(--blue)" /></div>
    </div>
    <div className="today-nutrition-divider" />
    <button type="button" className="today-nutrition-toggle" aria-expanded={nutritionOpen} onClick={() => setNutritionOpen((open) => !open)}>Full nutrition details<ChevronDown size={14} /></button>
    {nutritionOpen && <NutritionExpanded total={total} profile={profile} />}
  </section>;
}

export function TodayWater({ profile, dateKey, onSave }: { profile: Profile; dateKey: string; onSave: (profile: Profile) => void }) {
  const total = hydrationTotal(profile.waterEntries, dateKey);
  const target = profile.waterTargetMl || 2000;
  const glassMl = 250;
  const count = Math.round(total / glassMl);
  const goal = Math.max(1, Math.round(target / glassMl));
  const setCount = (next: number) => onSave({ ...profile, waterEntries: setWaterAmount(profile.waterEntries, dateKey, Math.max(0, Math.min(goal, next)) * glassMl) });
  return <section className="today-water card" aria-labelledby="today-water-heading">
    <div><span id="today-water-heading"><Droplet size={14} />Water</span><strong>{count} of {goal} glasses · {round(total / 1000, 2)} L</strong></div>
    <div className="today-water-controls"><button type="button" onClick={() => setCount(count - 1)} aria-label="Remove a glass">−</button><div>{Array.from({ length: goal }, (_, index) => <i className={index < count ? "filled" : ""} key={index} />)}</div><button type="button" className="add" onClick={() => setCount(count + 1)} aria-label="Add a glass">+</button></div>
  </section>;
}
