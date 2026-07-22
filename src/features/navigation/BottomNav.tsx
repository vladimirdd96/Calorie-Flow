"use client";

import { BarChart3, CalendarPlus, Home, MessageCircle, Search, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import type { AppTab } from "@/features/app/types";

export function BottomNav({ tab, onChange, planEnabled }: { tab: AppTab; onChange: (tab: AppTab) => void; planEnabled: boolean }) {
  const items: Array<{ tab: AppTab; label: string; icon: ReactNode }> = [
    { tab: "today", label: "Today", icon: <Home /> },
    { tab: "search", label: "Foods", icon: <Search /> },
    { tab: "coach", label: "Coach", icon: <MessageCircle /> },
    ...(planEnabled ? [{ tab: "plan" as const, label: "Plan", icon: <CalendarPlus /> }] : []),
    { tab: "insights", label: "Insights", icon: <BarChart3 /> },
    { tab: "profile", label: "Profile", icon: <UserRound /> },
  ];

  return <nav className={`bottom-nav ${planEnabled ? "" : "plan-hidden"}`} aria-label="Primary navigation">{items.map((item) => <button key={item.tab} type="button" aria-current={tab === item.tab ? "page" : undefined} className={`${tab === item.tab ? "active" : ""} ${item.tab === "coach" ? "coach-nav-item" : ""}`} onClick={() => onChange(item.tab)}>{item.icon}<span>{item.label}</span></button>)}</nav>;
}
