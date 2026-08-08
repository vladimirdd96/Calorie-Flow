"use client";

import { BookOpen, Plus, Sun, TrendingUp, UserRound } from "lucide-react";
import type { AppTab } from "@/features/navigation/types";

/**
 * Four destinations and the add action, deliberately. Coach is reached from the
 * Today header and from Profile — it does not get a slot here, because a sixth
 * item costs every other item the width that keeps this usable one-handed.
 */
const tabs = [
  { tab: "today", label: "Today", Icon: Sun },
  { tab: "plan", label: "Library", Icon: BookOpen },
  { tab: "insights", label: "Insights", Icon: TrendingUp },
  { tab: "profile", label: "Profile", Icon: UserRound },
] as const satisfies ReadonlyArray<{ tab: AppTab; label: string; Icon: typeof Sun }>;

export function BottomNav({ tab, onChange, onAdd }: { tab: AppTab; onChange: (tab: AppTab) => void; onAdd: () => void }) {
  const [before, after] = [tabs.slice(0, 2), tabs.slice(2)];
  const item = ({ tab: target, label, Icon }: typeof tabs[number]) => <button key={target} type="button" aria-current={tab === target ? "page" : undefined} className={tab === target ? "active" : ""} onClick={() => onChange(target)}><Icon /><span>{label}</span></button>;

  return <nav className="bottom-nav" aria-label="Primary navigation">
    {before.map(item)}
    <button type="button" className="bottom-nav-add" onClick={onAdd} aria-label="Add food"><Plus /></button>
    {after.map(item)}
  </nav>;
}
