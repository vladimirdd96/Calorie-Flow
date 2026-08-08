"use client";

import { ListPlus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getSetting, setSetting } from "@/lib/db";
import type { GroceryItem } from "@/lib/planning";

const SHOPPING_CHECKED_SETTING = "plan:shoppingChecked";

export function ShoppingList({ items, hasRecipes, onAddToList, onRemoveExtra }: { items: GroceryItem[]; hasRecipes: boolean; onAddToList?: (names: string[]) => void; onRemoveExtra?: (name: string) => void }) {
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

  return <section className="planned-groceries card workspace-panel" aria-label="Ingredients from your meal plan">
    <div className="section-heading compact">
      <div><span className="eyebrow">From your plan</span><h2>Planned ingredients</h2></div>
      {anyChecked && <button type="button" className="text-button muted" onClick={() => setChecked(new Set())}><Trash2 size={14} />Clear checked</button>}
      {items.length > 0 && onAddToList && <button type="button" className="text-button" onClick={() => onAddToList(items.map((item) => item.name))}><ListPlus size={14} />Add all to your list</button>}
    </div>
    {items.length ? <ul className="shopping-list">{items.map((item) => {
      const key = item.name.toLocaleLowerCase();
      const isChecked = checked.has(key);
      return <li key={item.name} className={`shopping-row${isChecked ? " checked" : ""}`}>
        <label><input type="checkbox" checked={isChecked} onChange={() => toggle(item.name)} /><span>{item.name}</span></label>
        {item.recipeNames.length > 0 ? <small>{item.recipeNames.join(", ")}</small> : <small>Added by you</small>}
        {item.recipeNames.length === 0 && onRemoveExtra && <button type="button" className="icon-button subtle-button" aria-label={`Remove ${item.name}`} onClick={() => onRemoveExtra(item.name)}><Trash2 size={13} /></button>}
      </li>;
    })}</ul> : <p>{hasRecipes ? "Plan a recipe for a day and its ingredients will appear here." : "Plan a saved recipe and its ingredients will appear here, ready to add to a list above."}</p>}
  </section>;
}
