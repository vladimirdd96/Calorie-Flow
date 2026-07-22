/** Tabs rendered by the tracker navigation feature. */
export const appTabs = {
  today: "today",
  search: "search",
  coach: "coach",
  plan: "plan",
  insights: "insights",
  profile: "profile",
} as const;

export type AppTab = typeof appTabs[keyof typeof appTabs];
