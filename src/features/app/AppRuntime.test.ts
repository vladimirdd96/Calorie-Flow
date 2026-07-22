import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("AppRuntime boundary", () => {
  it("stays a small route composition entry", () => {
    const source = readFileSync(resolve(process.cwd(), "src/features/app/AppRuntime.tsx"), "utf8");

    expect(source).toContain('import { AppShell } from "@/features/app/AppShell";');
    expect(source).toContain("return <AppShell />;");
    expect(source.split("\n").length).toBeLessThanOrEqual(12);
    expect(source).not.toMatch(/use(?:State|Effect|Memo|Callback|Ref)\s*\(/);
  });

  it("keeps product views outside the stateful app shell", () => {
    const source = readFileSync(resolve(process.cwd(), "src/features/app/AppShell.tsx"), "utf8");

    expect(source.split("\n").length).toBeLessThanOrEqual(600);
    expect(source).toContain('from "@/features/diary/DiaryView"');
    expect(source).toContain('from "@/features/food-capture/FoodCapture"');
    expect(source).toContain('from "@/features/profile/ProfileView"');
    expect(source).not.toMatch(/function (TodayView|InsightsView|ProfileView|AddFoodSheet|CoachView|PlanView)\(/);
  });
});
