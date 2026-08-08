"use client";

import { Check, MessageCircle, Package, Undo2, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { ClearableInput } from "@/features/shared/ClearableInput";
import { Sheet } from "@/features/shared/Sheet";
import { GroceryListMenu, type GroceryListMenuAction } from "./GroceryListMenu";
import type { GroceryItem, GroceryListsApi } from "../types";

type NameSheet = { kind: "create" | "rename"; value: string };

/** The editable grocery workspace. Owns list chrome and item rows; persistence lives in `useGroceryLists`. */
export function GroceryWorkspace({ api, onOpenCoach }: { api: GroceryListsApi; onOpenCoach?: () => void }) {
  const [itemDraft, setItemDraft] = useState("");
  const [nameSheet, setNameSheet] = useState<NameSheet | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [clearedItems, setClearedItems] = useState<GroceryItem[]>([]);

  const listId = api.activeListId;
  const items = api.activeList?.items || [];
  const pickedUp = items.filter((item) => item.checked).length;

  const addItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!itemDraft.trim() || !listId) return;
    api.addItems(listId, [itemDraft]);
    setItemDraft("");
  };
  const openAction = (action: GroceryListMenuAction) => {
    if (action === "delete") { setConfirmDelete(true); return; }
    setNameSheet({ kind: action, value: action === "rename" ? api.activeList?.name || "" : "" });
  };
  const submitName = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!nameSheet?.value.trim()) return;
    if (nameSheet.kind === "create") api.createList(nameSheet.value);
    else if (listId) api.renameList(listId, nameSheet.value);
    setNameSheet(null);
  };
  const clearPickedUp = () => {
    if (!listId) return;
    setClearedItems(items.filter((item) => item.checked));
    api.clearChecked(listId);
  };
  const undoClear = () => {
    if (listId) api.addItems(listId, clearedItems.map((item) => item.name));
    setClearedItems([]);
  };

  return <section className="grocery-workspace" aria-label="Grocery lists">
    <div className="grocery-toolbar">
      <GroceryListMenu api={api} onAction={openAction} />
      <form className="grocery-composer" onSubmit={addItem}>
        <ClearableInput value={itemDraft} onChange={(event) => setItemDraft(event.target.value)} onClear={() => setItemDraft("")} placeholder="Add an item" maxLength={120} clearLabel="Clear grocery item" aria-label="Add a grocery item" />
        <button type="submit" disabled={!itemDraft.trim()}>Add</button>
      </form>
    </div>

    {clearedItems.length > 0 && <div className="grocery-undo" role="status">
      <span>{clearedItems.length} picked-up {clearedItems.length === 1 ? "item" : "items"} cleared</span>
      <button type="button" className="text-button" onClick={undoClear}><Undo2 size={14} />Undo</button>
    </div>}

    {items.length > 0 ? <>
      <div className="grocery-list">{items.map((item) => <div key={item.id} className={item.checked ? "checked" : ""}>
        <button type="button" className="grocery-toggle" onClick={() => api.toggleItem(listId, item.id)} aria-pressed={item.checked} aria-label={`Mark ${item.name} as ${item.checked ? "needed" : "picked up"}`}>{item.checked && <Check size={14} />}</button>
        <span>{item.name}</span>
        <button type="button" className="grocery-remove" onClick={() => api.removeItem(listId, item.id)} aria-label={`Remove ${item.name}`}><X size={16} /></button>
      </div>)}</div>
      {pickedUp > 0 && <button type="button" className="text-button muted clear-picked" onClick={clearPickedUp}>Clear {pickedUp} picked-up {pickedUp === 1 ? "item" : "items"}</button>}
    </> : <div className="grocery-empty">
      <Package size={28} />
      <strong>Nothing on this list yet</strong>
      <p>Add items yourself, or ask Coach for a recipe and send its ingredients straight here. Separate lists keep a weekly shop apart from a meal plan.</p>
      {onOpenCoach && <button type="button" className="secondary-button" onClick={onOpenCoach}><MessageCircle size={16} />Ask Coach for a recipe</button>}
    </div>}

    {nameSheet && <Sheet label={nameSheet.kind === "create" ? "Create a grocery list" : "Rename this grocery list"} onClose={() => setNameSheet(null)}>
      <div className="sheet-header"><span /><div><span className="eyebrow">Your lists</span><h2>{nameSheet.kind === "create" ? "New list" : "Rename list"}</h2></div><span /></div>
      <form className="grocery-list-create" onSubmit={submitName}>
        <ClearableInput autoFocus value={nameSheet.value} onChange={(event) => setNameSheet({ ...nameSheet, value: event.target.value })} onClear={() => setNameSheet({ ...nameSheet, value: "" })} placeholder="List name" maxLength={60} clearLabel="Clear list name" aria-label="List name" />
        <button className="primary-button" type="submit" disabled={!nameSheet.value.trim()}>{nameSheet.kind === "create" ? "Create" : "Save"}</button>
      </form>
    </Sheet>}

    {confirmDelete && api.activeList && <Sheet label={`Delete ${api.activeList.name}`} onClose={() => setConfirmDelete(false)}>
      <div className="sheet-header"><span /><div><span className="eyebrow">Your lists</span><h2>Delete this list?</h2></div><span /></div>
      <p><strong>{api.activeList.name}</strong> and its {api.activeList.items.length} {api.activeList.items.length === 1 ? "item" : "items"} will be removed. {api.lists.length < 2 ? "A new empty list takes its place." : "Your other lists are untouched."}</p>
      <div className="sheet-actions">
        <button type="button" className="secondary-button" onClick={() => setConfirmDelete(false)}>Keep list</button>
        <button type="button" className="primary-button danger-button" onClick={() => { api.deleteList(listId); setConfirmDelete(false); }}>Delete list</button>
      </div>
    </Sheet>}
  </section>;
}
