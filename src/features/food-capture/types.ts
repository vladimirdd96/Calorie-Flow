/** Entry views owned by the food-capture flow. */
export const addFoodViews = {
  start: "start",
  search: "search",
  scan: "scan",
  label: "label",
  camera: "camera",
  photo: "photo",
  manual: "manual",
  quick: "quick",
  "barcode-not-found": "barcode-not-found",
} as const;

export type AddFoodView = typeof addFoodViews[keyof typeof addFoodViews];
