"use client";

import { ChevronRight, Plus } from "lucide-react";
import { FormEvent, useState } from "react";
import { ClearableInput } from "@/features/shared/ClearableInput";
import { Sheet } from "@/features/shared/Sheet";
import type { GroceryListsApi } from "../types";

/** Asks which list a batch of ingredients belongs on, and can create one on the spot. */
export function ChooseGroceryListSheet({ api, items, onClose, onChosen }: { api: GroceryListsApi; items: string[]; onClose: () => void; onChosen: (listId: string) => void }) {
  const [newListName, setNewListName] = useState<string | null>(null);
  const label = `${items.length} ${items.length === 1 ? "ingredient" : "ingredients"}`;

  const create = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const listId = api.createList(newListName || "", items);
    if (listId) onChosen(listId);
  };

  return <Sheet label="Choose a grocery list" onClose={onClose}>
    <div className="sheet-header"><span /><div><span className="eyebrow">Add ingredients</span><h2>Choose a list</h2></div><span /></div>
    <p className="grocery-modal-copy">Where should {items.length === 1 ? "this ingredient" : `these ${label}`} go?</p>
    {newListName === null ? <>
      <div className="grocery-list-choices">{api.lists.map((list) => <button key={list.id} type="button" onClick={() => { api.addItems(list.id, items); onChosen(list.id); }}>
        <span><strong>{list.name}</strong><small>{list.items.filter((item) => !item.checked).length} still needed</small></span>
        <ChevronRight size={17} aria-hidden="true" />
      </button>)}</div>
      <button type="button" className="secondary-button full" onClick={() => setNewListName("")}><Plus size={16} />Create a new list</button>
    </> : <form className="grocery-list-create" onSubmit={create}>
      <ClearableInput autoFocus value={newListName} onChange={(event) => setNewListName(event.target.value)} onClear={() => setNewListName("")} placeholder="List name" maxLength={60} clearLabel="Clear list name" aria-label="New list name" />
      <button className="primary-button" type="submit" disabled={!newListName.trim()}>Create</button>
    </form>}
  </Sheet>;
}
