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

export type InsightsSection = "overview" | "nutrition" | "weight" | "fasting";
export type PlanSection = "week" | "recipes" | "catalogue" | "shopping";
export type CoachSection = "chat" | "groceries";
export type ProfileSection = "profile" | "customize";

/** A complete in-app destination, including a page's active section where applicable. */
export type AppNavigationTarget =
  | { tab: "today" | "search" }
  | { tab: "insights"; section?: InsightsSection }
  | { tab: "plan"; section?: PlanSection }
  | { tab: "coach"; section?: CoachSection }
  | { tab: "profile"; section?: ProfileSection };
