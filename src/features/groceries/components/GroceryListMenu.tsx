"use client";

import { Check, ChevronDown, ListPlus, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { GroceryListsApi } from "../types";

export type GroceryListMenuAction = "create" | "rename" | "delete";

/**
 * One control for everything list-shaped: pick a list, or start creating,
 * renaming or deleting one. Replaces the separate select, pencil and New list
 * buttons that all led to the same place.
 */
export function GroceryListMenu({ api, onAction }: { api: GroceryListsApi; onAction: (action: GroceryListMenuAction) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", close); };
  }, [open]);

  const choose = (action: GroceryListMenuAction) => { setOpen(false); onAction(action); };

  return <div className="grocery-list-menu" ref={rootRef}>
    <button type="button" className="grocery-list-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <span>{api.activeList?.name || "Groceries"}</span>
      <small>{api.activeList?.items.filter((item) => !item.checked).length || 0} left</small>
      <ChevronDown size={16} aria-hidden="true" />
    </button>
    {open && <div className="grocery-list-dropdown" role="menu">
      {api.lists.map((list) => <button key={list.id} type="button" role="menuitemradio" aria-checked={list.id === api.activeListId} className={list.id === api.activeListId ? "active" : ""} onClick={() => { setOpen(false); api.selectList(list.id); }}>
        <span>{list.name}<small>{list.items.filter((item) => !item.checked).length} still needed</small></span>
        {list.id === api.activeListId && <Check size={16} aria-hidden="true" />}
      </button>)}
      <div className="grocery-list-dropdown-actions">
        <button type="button" role="menuitem" onClick={() => choose("create")}><ListPlus size={15} />New list</button>
        <button type="button" role="menuitem" onClick={() => choose("rename")} disabled={!api.activeList}><Pencil size={15} />Rename list</button>
        <button type="button" role="menuitem" className="danger" onClick={() => choose("delete")} disabled={!api.activeList}><Trash2 size={15} />Delete list</button>
      </div>
    </div>}
  </div>;
}
