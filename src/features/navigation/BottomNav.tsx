"use client";

import { CalendarRange, Plus, Sun, TrendingUp, UserRound } from "lucide-react";
import type { AppTab } from "@/features/navigation/types";

export function BottomNav({ tab, onChange, onAdd, planEnabled }: { tab: AppTab; onChange: (tab: AppTab) => void; onAdd: () => void; planEnabled: boolean }) {
  return <nav className={`bottom-nav${planEnabled ? " plan-enabled" : ""}`} aria-label="Primary navigation">
    <button type="button" aria-current={tab === "today" ? "page" : undefined} className={tab === "today" ? "active" : ""} onClick={() => onChange("today")}><Sun /><span>Today</span></button>
    <button type="button" aria-current={tab === "plan" ? "page" : undefined} className={tab === "plan" ? "active" : ""} onClick={() => onChange("plan")}><CalendarRange /><span>Plan</span></button>
    <button type="button" className="bottom-nav-add" onClick={onAdd} aria-label="Add food"><Plus /></button>
    <button type="button" aria-current={tab === "insights" ? "page" : undefined} className={tab === "insights" ? "active" : ""} onClick={() => onChange("insights")}><TrendingUp /><span>Insights</span></button>
    <button type="button" aria-current={tab === "profile" ? "page" : undefined} className={tab === "profile" ? "active" : ""} onClick={() => onChange("profile")}><UserRound /><span>Profile</span></button>
  </nav>;
}
