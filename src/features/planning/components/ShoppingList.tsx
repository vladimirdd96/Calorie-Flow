"use client";

import { ListChecks, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getSetting, setSetting } from "@/lib/db";
import type { GroceryItem } from "@/lib/planning";

const SHOPPING_CHECKED_SETTING = "plan:shoppingChecked";

export function ShoppingList({ items, hasRecipes, onRemoveExtra }: { items: GroceryItem[]; hasRecipes: boolean; onRemoveExtra?: (name: string) => void }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    getSetting<string[]>(SHOPPING_CHECKED_SETTING).then((stored) => { if (active) { setChecked(new Set(stored || [])); setLoaded(true); } });
    return () => { active = false; };
  }, []);

  useEffect(() => { if (loaded) void setSetting(SHOPPING_CHECKED_SETTING, [...checked]); }, [checked, loaded]);

  const toggle = (name: string) => setChecked((current) => {
    const next = new Set(current);
    const key = name.toLocaleLowerCase();
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const anyChecked = checked.size > 0;

  return <section id="plan-shopping-panel" role="tabpanel" aria-labelledby="plan-shopping-tab" className="planned-groceries card workspace-panel">
    <div className="section-heading compact">
      <div><span className="eyebrow">From your plan</span><h2>Shopping list</h2></div>
      {anyChecked ? <button type="button" className="text-button muted" onClick={() => setChecked(new Set())}><Trash2 size={14} />Clear checked</button> : <ListChecks size={18} />}
    </div>
    {items.length ? <ul className="shopping-list">{items.map((item) => {
      const key = item.name.toLocaleLowerCase();
      const isChecked = checked.has(key);
      return <li key={item.name} className={`shopping-row${isChecked ? " checked" : ""}`}>
        <label><input type="checkbox" checked={isChecked} onChange={() => toggle(item.name)} /><span>{item.name}</span></label>
        {item.recipeNames.length > 0 ? <small>{item.recipeNames.join(", ")}</small> : <small>Added by you</small>}
        {item.recipeNames.length === 0 && onRemoveExtra && <button type="button" className="icon-button subtle-button" aria-label={`Remove ${item.name}`} onClick={() => onRemoveExtra(item.name)}><Trash2 size={13} /></button>}
      </li>;
    })}</ul> : <p>{hasRecipes ? "Plan a recipe for a day and its ingredients will appear here." : "Plan a saved recipe and its ingredients will appear here. Your existing Coach grocery lists remain available in Coach."}</p>}
  </section>;
}
