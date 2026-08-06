"use client";

import { ChevronRight, Droplet, Scale, Timer } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Sheet } from "@/features/shared/Sheet";
import { activeFast, fastingWindowHours, formatFastingDuration, uniqueFastingRecords } from "@/lib/fasting";
import { isHabitFeatureEnabled } from "@/lib/habit-settings";
import { hydrationTotal, setWaterAmount } from "@/lib/hydration";
import { recentLogDates } from "@/lib/logging";
import { round } from "@/lib/nutrition";
import { habitFeatures, type Meal, type Profile } from "@/lib/types";
import type { InsightsSection } from "@/features/navigation/types";

/** Tiles rendered by the habit strip, in the order they appear under the hero. */
export const habitTileKeys = { fasting: "fasting", weight: "weight", water: "water" } as const;
export type HabitTileKey = typeof habitTileKeys[keyof typeof habitTileKeys];

const fastingGoals = [12, 14, 16, 18] as const;
const defaultGlassMl = 250;
const trendPointCount = 7;

type TrendPoint = { key: string; label: string; value: number; reached?: boolean };

const dayLabel = (date: Date) => date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1);

/** Weight moves inside a narrow band, so its bars are scaled to the band rather than to zero. */
function HabitTrend({ points, caption, scale = "zero" }: { points: TrendPoint[]; caption: string; scale?: "zero" | "band" }) {
  if (points.length < 2) return <p className="habit-trend-empty">{caption}</p>;
  const values = points.map((point) => point.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const floor = scale === "band" ? min - Math.max(0.4, (max - min) * 0.8) : 0;
  const span = Math.max(0.1, max - floor);
  return <div className="habit-trend" aria-hidden="true">
    {points.map((point) => <div className="habit-trend-column" key={point.key}>
      <div className="habit-trend-bar-wrap"><i className={point.reached ? "reached" : ""} style={{ height: `${Math.max(6, (point.value - floor) / span * 100)}%` }} /></div>
      <small>{point.label}</small>
    </div>)}
  </div>;
}

function SheetShell({ eyebrow, title, value, children, historyLabel, onOpenHistory }: { eyebrow: string; title: string; value: ReactNode; children: ReactNode; historyLabel: string; onOpenHistory: () => void }) {
  return <div className="habit-sheet">
    <div className="sheet-header"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><span /></div>
    <p className="habit-sheet-value">{value}</p>
    {children}
    <button type="button" className="today-trend-link" onClick={onOpenHistory}>{historyLabel}<ChevronRight size={14} /></button>
  </div>;
}

function FastingSheet({ profile, onSave, onOpenHistory }: { profile: Profile; onSave: (profile: Profile) => void; onOpenHistory: () => void }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const goal = profile.fastingGoalHours || 16;
  const record = activeFast(profile.fastingRecords);
  const elapsed = record ? fastingWindowHours(record.startedAt, now.toISOString()) : 0;
  const points: TrendPoint[] = uniqueFastingRecords(profile.fastingRecords)
    .filter((entry): entry is typeof entry & { endedAt: string } => Boolean(entry.endedAt))
    .sort((a, b) => a.endedAt.localeCompare(b.endedAt))
    .slice(-trendPointCount)
    .map((entry) => {
      const hours = fastingWindowHours(entry.startedAt, entry.endedAt);
      return { key: entry.id, label: dayLabel(new Date(entry.endedAt)), value: hours, reached: hours >= goal };
    });
  return <SheetShell
    eyebrow="Optional rhythm"
    title="Fasting"
    value={<>{record ? <strong>{formatFastingDuration(elapsed)}</strong> : <strong>Not fasting</strong>}<span> of {goal} h goal</span></>}
    historyLabel="See fasting history"
    onOpenHistory={onOpenHistory}
  >
    <div className="habit-sheet-progress"><i style={{ width: `${Math.min(100, elapsed / goal * 100)}%` }} /></div>
    <HabitTrend points={points} caption="Completed fasts appear here once you log a meal after a window." />
    <span className="habit-sheet-label">Goal</span>
    <div className="today-goal-options">{fastingGoals.map((hours) => <button key={hours} type="button" className={goal === hours ? "active" : ""} aria-pressed={goal === hours} onClick={() => onSave({ ...profile, fastingGoalHours: hours })}>{hours} h</button>)}</div>
  </SheetShell>;
}

function WeightSheet({ profile, onSave, onOpenHistory }: { profile: Profile; onSave: (profile: Profile) => void; onOpenHistory: () => void }) {
  const entries = [...(profile.weightEntries || [])].sort((a, b) => a.date.localeCompare(b.date));
  const latest = entries.at(-1)?.weightKg ?? profile.weightKg;
  const [draft, setDraft] = useState(String(round(latest)));
  const save = () => {
    const weightKg = Number(draft);
    if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 500) return;
    const date = new Date().toISOString().slice(0, 10);
    onSave({ ...profile, weightKg, weightEntries: [...entries.filter((entry) => entry.date !== date), { date, weightKg }].sort((a, b) => a.date.localeCompare(b.date)) });
  };
  const points: TrendPoint[] = entries.slice(-trendPointCount).map((entry) => ({ key: entry.date, label: dayLabel(new Date(`${entry.date}T12:00:00`)), value: entry.weightKg }));
  const change = points.length > 1 ? points[points.length - 1].value - points[0].value : 0;
  return <SheetShell
    eyebrow="Optional progress"
    title="Weight"
    value={<><strong>{round(latest)} kg</strong>{points.length > 1 && <span> · {change > 0 ? "+" : ""}{round(change)} kg over {points.length} weigh-ins</span>}</>}
    historyLabel="See weight history"
    onOpenHistory={onOpenHistory}
  >
    <HabitTrend points={points} scale="band" caption="Log two weigh-ins to see your trend here." />
    <span className="habit-sheet-label">Today&apos;s weigh-in</span>
    <div className="today-weigh-row">
      <label><span className="visually-hidden">Weight in kilograms</span><input autoFocus inputMode="decimal" value={draft} onChange={(event) => setDraft(event.target.value)} /><small>kg</small></label>
      <button type="button" className="primary-button" onClick={save}>Save</button>
    </div>
  </SheetShell>;
}

function WaterSheet({ profile, dateKey, onSave, onOpenHistory }: { profile: Profile; dateKey: string; onSave: (profile: Profile) => void; onOpenHistory: () => void }) {
  const glassMl = profile.glassSizeMl || defaultGlassMl;
  const target = profile.waterTargetMl || 2000;
  const total = hydrationTotal(profile.waterEntries, dateKey);
  const count = Math.round(total / glassMl);
  const goal = Math.max(1, Math.round(target / glassMl));
  const setCount = (next: number) => onSave({ ...profile, waterEntries: setWaterAmount(profile.waterEntries, dateKey, Math.max(0, Math.min(goal, next)) * glassMl) });
  const points: TrendPoint[] = [...recentLogDates(new Date(), trendPointCount)].reverse().map((date) => {
    const glasses = Math.round(hydrationTotal(profile.waterEntries, date) / glassMl);
    return { key: date, label: dayLabel(new Date(`${date}T12:00:00`)), value: glasses, reached: glasses >= goal };
  });
  return <SheetShell
    eyebrow="Optional rhythm"
    title="Water"
    value={<><strong>{count} of {goal} glasses</strong><span> · {round(total / 1000, 2)} L</span></>}
    historyLabel="See hydration insights"
    onOpenHistory={onOpenHistory}
  >
    <HabitTrend points={points} caption="Log a few days to see your hydration trend." />
    <span className="habit-sheet-label">Today</span>
    <div className="today-water-controls">
      <button type="button" onClick={() => setCount(count - 1)} aria-label="Remove a glass">−</button>
      <div>{Array.from({ length: goal }, (_, index) => <i className={index < count ? "filled" : ""} key={index} />)}</div>
      <button type="button" className="add" onClick={() => setCount(count + 1)} aria-label="Add a glass">+</button>
    </div>
  </SheetShell>;
}

export function HabitStrip({ profile, dateKey, onSaveProfile, onOpenInsights }: { profile: Profile; meals: Meal[]; dateKey: string; onSaveProfile: (profile: Profile) => void; onOpenInsights: (section?: InsightsSection) => void }) {
  const [openTile, setOpenTile] = useState<HabitTileKey>();
  const glassMl = profile.glassSizeMl || defaultGlassMl;
  const fast = activeFast(profile.fastingRecords);
  const latestWeight = [...(profile.weightEntries || [])].sort((a, b) => b.date.localeCompare(a.date))[0]?.weightKg || profile.weightKg;
  const waterCount = Math.round(hydrationTotal(profile.waterEntries, dateKey) / glassMl);
  const waterGoal = Math.max(1, Math.round((profile.waterTargetMl || 2000) / glassMl));
  const tiles: Array<{ key: HabitTileKey; icon: ReactNode; value: string; label: string }> = [];
  if (isHabitFeatureEnabled(profile.enabledHabitFeatures, habitFeatures.fasting)) tiles.push({ key: habitTileKeys.fasting, icon: <Timer size={15} />, value: fast ? `${round(fastingWindowHours(fast.startedAt, new Date().toISOString()))}h` : "—", label: "fasted" });
  if (profile.weightTracking === "enabled") tiles.push({ key: habitTileKeys.weight, icon: <Scale size={15} />, value: `${round(latestWeight)} kg`, label: "weight" });
  if (isHabitFeatureEnabled(profile.enabledHabitFeatures, habitFeatures.water)) tiles.push({ key: habitTileKeys.water, icon: <Droplet size={15} />, value: `${waterCount} / ${waterGoal}`, label: "water" });
  if (!tiles.length) return null;
  const closeSheet = () => setOpenTile(undefined);
  const openHistory = (section: InsightsSection) => { closeSheet(); onOpenInsights(section); };
  return <>
    <section className={`habit-strip card${tiles.length === 1 ? " single" : ""}`} aria-label="Optional habits">
      {tiles.map((tile) => <button key={tile.key} type="button" className={`habit-tile ${tile.key}`} aria-haspopup="dialog" onClick={() => setOpenTile(tile.key)}>
        <span className="habit-tile-icon">{tile.icon}</span>
        <strong>{tile.value}</strong>
        <small>{tile.label}</small>
      </button>)}
    </section>
    {openTile === habitTileKeys.fasting && <Sheet onClose={closeSheet} label="Fasting"><FastingSheet profile={profile} onSave={onSaveProfile} onOpenHistory={() => openHistory("fasting")} /></Sheet>}
    {openTile === habitTileKeys.weight && <Sheet onClose={closeSheet} label="Weight"><WeightSheet profile={profile} onSave={onSaveProfile} onOpenHistory={() => openHistory("weight")} /></Sheet>}
    {openTile === habitTileKeys.water && <Sheet onClose={closeSheet} label="Water"><WaterSheet profile={profile} dateKey={dateKey} onSave={onSaveProfile} onOpenHistory={() => openHistory("overview")} /></Sheet>}
  </>;
}
