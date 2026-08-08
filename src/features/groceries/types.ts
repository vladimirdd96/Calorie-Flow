/** Grocery lists are a user-owned workspace: several named lists, each a set of tickable items. */
export type GroceryItem = { id: string; name: string; checked: boolean; addedAt: string };

export type GroceryList = { id: string; name: string; items: GroceryItem[]; createdAt: string; updatedAt: string };

export const GROCERY_ITEMS_SETTING = "coach:grocery-items";

export const DEFAULT_GROCERY_LIST_NAME = "My groceries";

export function isGroceryItem(value: unknown): value is GroceryItem {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.name === "string" && typeof record.checked === "boolean" && typeof record.addedAt === "string";
}

/** Every mutation the workspace and its cross-feature callers need, so no consumer touches persistence itself. */
export type GroceryListsApi = {
  ready: boolean;
  lists: GroceryList[];
  activeListId: string;
  activeList?: GroceryList;
  remainingCount: number;
  selectList: (listId: string) => void;
  addItems: (listId: string, names: string[]) => void;
  toggleItem: (listId: string, itemId: string) => void;
  removeItem: (listId: string, itemId: string) => void;
  clearChecked: (listId: string) => void;
  createList: (name: string, items?: string[]) => string | undefined;
  renameList: (listId: string, name: string) => void;
  deleteList: (listId: string) => void;
};
