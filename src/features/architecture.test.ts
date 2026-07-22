import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const featuresRoot = resolve(process.cwd(), "src/features");
const privateFolderImport = /@\/features\/([^/]+)\/(?:components|hooks|lib)\//g;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(path) && !path.endsWith(".test.ts") ? [path] : [];
  });
}

describe("vertical feature slice architecture", () => {
  it("keeps feature source modules focused", () => {
    for (const file of sourceFiles(featuresRoot)) {
      const lines = readFileSync(file, "utf8").split("\n").length;
      expect(lines, relative(featuresRoot, file)).toBeLessThanOrEqual(500);
    }
  });

  it("does not couple a feature to another feature's private implementation", () => {
    for (const file of sourceFiles(featuresRoot)) {
      const source = readFileSync(file, "utf8");
      const owner = relative(featuresRoot, file).split("/")[0];
      for (const match of source.matchAll(privateFolderImport)) {
        expect(match[1], relative(featuresRoot, file)).toBe(owner);
      }
    }
  });

  it("keeps coordination hooks with the tracker feature", () => {
    for (const hook of ["useLocalFirstData.ts", "useTrackerActions.ts", "useTrackerUiState.ts"]) {
      expect(() => statSync(join(featuresRoot, "tracker", "hooks", hook))).not.toThrow();
    }
  });
});
