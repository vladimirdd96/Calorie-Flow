import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("in-app navigation destinations", () => {
  it("keeps a page's requested section with its navigation target", () => {
    const navigation = source("src/features/navigation/types.ts");
    const tracker = source("src/features/tracker/TrackerApp.tsx");
    const uiState = source("src/features/tracker/hooks/useTrackerUiState.ts");

    expect(navigation).toContain("export type AppNavigationTarget");
    expect(navigation).toContain('section?: InsightsSection');
    expect(uiState).toContain('const tab = navigationTarget.tab;');
    expect(uiState).not.toContain("setCurrentTab");
    expect(tracker).toContain('navigateTo({ tab: "insights", section })');
    expect(tracker).toContain('initialSection={navigationTarget.tab === "insights" ? navigationTarget.section : undefined}');
  });

  it("sends weight and fasting history shortcuts to their matching Insights tabs", () => {
    const diary = source("src/features/diary/DiaryView.tsx");
    const habitStrip = source("src/features/diary/components/HabitStrip.tsx");
    const profile = source("src/features/profile/ProfileView.tsx");

    expect(diary).toContain("onOpenInsights={onOpenInsights}");
    expect(habitStrip).toContain('openHistory("weight")');
    expect(habitStrip).toContain('openHistory("fasting")');
    expect(habitStrip).toContain("See weight history");
    expect(habitStrip).toContain("See fasting history");
    expect(profile).toContain('onNavigate({ tab: "insights", section: "weight" })');
  });
});
