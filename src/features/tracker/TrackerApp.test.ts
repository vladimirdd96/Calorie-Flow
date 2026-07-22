import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("tracker feature boundary", () => {
  it("uses one feature entry point directly from the Next.js route", () => {
    const page = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");

    expect(page).toContain('import { TrackerApp } from "@/features/tracker/TrackerApp";');
    expect(page).toContain("return <TrackerApp />;");
    expect(() => readFileSync(resolve(process.cwd(), "src/components/TrackerApp.tsx"), "utf8")).toThrow();
    expect(() => readFileSync(resolve(process.cwd(), "src/features/app/AppRuntime.tsx"), "utf8")).toThrow();
  });

  it("coordinates feature slices without defining their views", () => {
    const source = readFileSync(resolve(process.cwd(), "src/features/tracker/TrackerApp.tsx"), "utf8");

    expect(source).toContain('from "@/features/tracker/useTrackerUiState"');
    expect(source).toContain('from "@/features/tracker/useLocalFirstData"');
    expect(source).toContain('from "@/features/tracker/useTrackerActions"');
    expect(source).toContain('from "@/features/diary/DiaryView"');
    expect(source).toContain('from "@/features/food-capture/FoodCapture"');
    expect(source).toContain('from "@/features/profile/ProfileView"');
    expect(source).not.toMatch(/function (TodayView|InsightsView|ProfileView|AddFoodSheet|CoachView|PlanView)\(/);
  });
});
