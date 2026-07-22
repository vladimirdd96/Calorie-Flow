/** App-shell navigation is intentionally small and shared by feature entry points. */
export const appTabs = {
  today: "today",
  search: "search",
  coach: "coach",
  plan: "plan",
  insights: "insights",
  profile: "profile",
} as const;

export type AppTab = typeof appTabs[keyof typeof appTabs];

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
