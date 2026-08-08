"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSetting, setSetting } from "@/lib/db";
import { DEFAULT_GROCERY_LIST_NAME, GROCERY_ITEMS_SETTING, isGroceryItem, type GroceryList, type GroceryListsApi } from "../types";

const now = () => new Date().toISOString();

function freshList(name = DEFAULT_GROCERY_LIST_NAME, names: string[] = []): GroceryList {
  const createdAt = now();
  return { id: crypto.randomUUID(), name, items: names.map((item) => ({ id: crypto.randomUUID(), name: item, checked: false, addedAt: createdAt })), createdAt, updatedAt: createdAt };
}

/**
 * Reads whatever shape the setting holds today: an array of lists, the original
 * flat array of items from before lists existed, or nothing at all.
 */
function listsFromStored(stored: unknown): GroceryList[] {
  if (Array.isArray(stored) && stored.every((value) => value && typeof value === "object" && "items" in value)) {
    const lists = stored.flatMap((value) => {
      const record = value as Record<string, unknown>;
      if (typeof record.id !== "string" || typeof record.name !== "string" || !Array.isArray(record.items)) return [];
      return [{
        id: record.id,
        name: record.name,
        items: record.items.filter(isGroceryItem),
        createdAt: typeof record.createdAt === "string" ? record.createdAt : now(),
        updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : now(),
      }];
    });
    if (lists.length) return lists;
  }
  return [freshList(DEFAULT_GROCERY_LIST_NAME, [])].map((list) => Array.isArray(stored)
    ? { ...list, items: stored.filter(isGroceryItem) }
    : list);
}

const uniqueNames = (names: string[]) => [...new Set(names.map((name) => name.trim()).filter(Boolean))];

/** Owns the signed-in account's grocery lists and their local persistence. */
export function useGroceryLists(userId?: string): GroceryListsApi {
  const settingKey = userId ? `${GROCERY_ITEMS_SETTING}:${userId}` : undefined;
  // Lists carry the key they were loaded for, so signing out or switching
  // accounts cannot surface the previous account's lists while the new ones load.
  const [loaded, setLoaded] = useState<{ key: string; lists: GroceryList[] }>();
  const [selectedListId, setSelectedListId] = useState("");

  useEffect(() => {
    let active = true;
    if (!settingKey) return;
    const adopt = (lists: GroceryList[]) => { if (active) setLoaded({ key: settingKey, lists }); };
    getSetting<unknown>(settingKey)
      .then((stored) => {
        const available = listsFromStored(stored);
        adopt(available);
        void setSetting(settingKey, available);
      })
      .catch(() => adopt([freshList()]));
    return () => { active = false; };
  }, [settingKey]);

  const ready = Boolean(settingKey) && loaded?.key === settingKey;
  const lists = useMemo(() => ready && loaded ? loaded.lists : [], [loaded, ready]);

  const update = useCallback((updater: (current: GroceryList[]) => GroceryList[]) => {
    if (!settingKey) return;
    setLoaded((current) => {
      if (current?.key !== settingKey) return current;
      const next = updater(current.lists);
      void setSetting(settingKey, next);
      return { key: settingKey, lists: next };
    });
  }, [settingKey]);

  const updateList = useCallback((listId: string, updater: (list: GroceryList) => GroceryList) => {
    update((current) => current.map((list) => list.id === listId ? { ...updater(list), updatedAt: now() } : list));
  }, [update]);

  const addItems = useCallback((listId: string, names: string[]) => {
    const wanted = uniqueNames(names);
    if (!wanted.length) return;
    updateList(listId, (list) => {
      const seen = new Set(list.items.map((item) => item.name.toLocaleLowerCase()));
      const added = wanted.filter((name) => !seen.has(name.toLocaleLowerCase()))
        .map((name) => ({ id: crypto.randomUUID(), name, checked: false, addedAt: now() }));
      return { ...list, items: [...list.items, ...added] };
    });
    setSelectedListId(listId);
  }, [updateList]);

  const createList = useCallback((name: string, items: string[] = []) => {
    const trimmed = name.trim();
    if (!trimmed || !ready) return undefined;
    const list = freshList(trimmed.slice(0, 60), uniqueNames(items));
    update((current) => [...current, list]);
    setSelectedListId(list.id);
    return list.id;
  }, [ready, update]);

  /** Deleting the last list leaves a fresh empty one rather than an unusable workspace. */
  const deleteList = useCallback((listId: string) => {
    update((current) => {
      const remaining = current.filter((list) => list.id !== listId);
      return remaining.length ? remaining : [freshList()];
    });
  }, [update]);

  // Falling back to the first list keeps a stale selection from blanking the workspace.
  const activeList = lists.find((list) => list.id === selectedListId) || lists[0];

  return useMemo<GroceryListsApi>(() => ({
    ready,
    lists,
    activeListId: activeList?.id || "",
    activeList,
    remainingCount: lists.reduce((total, list) => total + list.items.filter((item) => !item.checked).length, 0),
    selectList: setSelectedListId,
    addItems,
    toggleItem: (listId, itemId) => updateList(listId, (list) => ({ ...list, items: list.items.map((item) => item.id === itemId ? { ...item, checked: !item.checked } : item) })),
    removeItem: (listId, itemId) => updateList(listId, (list) => ({ ...list, items: list.items.filter((item) => item.id !== itemId) })),
    clearChecked: (listId) => updateList(listId, (list) => ({ ...list, items: list.items.filter((item) => !item.checked) })),
    createList,
    renameList: (listId, name) => { const trimmed = name.trim(); if (trimmed) updateList(listId, (list) => ({ ...list, name: trimmed.slice(0, 60) })); },
    deleteList,
  }), [activeList, addItems, createList, deleteList, lists, ready, updateList]);
}
