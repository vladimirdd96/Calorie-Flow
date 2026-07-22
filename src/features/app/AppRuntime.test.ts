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
});
