/**
 * Public API of the groceries slice. The workspace lives in the Library's
 * Shopping tab; Coach reaches it only through these exports.
 */
export { GroceryWorkspace } from "./components/GroceryWorkspace";
export { ChooseGroceryListSheet } from "./components/ChooseGroceryListSheet";
export { useGroceryLists } from "./hooks/useGroceryLists";
export { DEFAULT_GROCERY_LIST_NAME, GROCERY_ITEMS_SETTING } from "./types";
export type { GroceryItem, GroceryList, GroceryListsApi } from "./types";
