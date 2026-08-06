import { describe, expect, it } from "vitest";
import { splitIngredientLine, splitIngredientLines } from "./ingredients";
import { scaleIngredientQuantity } from "../planning";

describe("splitIngredientLine", () => {
  it("separates a whole-number amount and unit from the food", () => {
    expect(splitIngredientLine("2 cups cooked rice")).toEqual({ quantity: "2 cups", name: "cooked rice" });
  });

  it("keeps a unicode fraction", () => {
    expect(splitIngredientLine("1½ lb chicken thighs")).toEqual({ quantity: "1½ lb", name: "chicken thighs" });
  });

  it("converts an ascii fraction rather than reading it as a whole number", () => {
    expect(splitIngredientLine("1/2 tsp salt")).toEqual({ quantity: "½ tsp", name: "salt" });
    expect(splitIngredientLine("1 1/2 cups flour")).toEqual({ quantity: "1½ cups", name: "flour" });
  });

  it("normalizes a decimal into a scalable fraction", () => {
    expect(splitIngredientLine("1.5 cups milk")).toEqual({ quantity: "1½ cups", name: "milk" });
  });

  it("takes the lower bound of a range", () => {
    expect(splitIngredientLine("2–3 cloves garlic")).toEqual({ quantity: "2 cloves", name: "garlic" });
    expect(splitIngredientLine("1 to 2 tbsp olive oil")).toEqual({ quantity: "1 tbsp", name: "olive oil" });
  });

  it("handles a countable ingredient with no unit", () => {
    expect(splitIngredientLine("3 eggs")).toEqual({ quantity: "3", name: "eggs" });
  });

  it("drops a connecting 'of'", () => {
    expect(splitIngredientLine("2 cups of spinach")).toEqual({ quantity: "2 cups", name: "spinach" });
  });

  it("leaves a line with no amount untouched", () => {
    expect(splitIngredientLine("Salt and pepper to taste")).toEqual({ name: "Salt and pepper to taste" });
  });

  it("keeps a bare measurement whole rather than emitting an empty name", () => {
    expect(splitIngredientLine("2 cups")).toEqual({ name: "2 cups" });
  });

  it("collapses whitespace and ignores blank lines", () => {
    expect(splitIngredientLine("  2   cups   rice  ")).toEqual({ quantity: "2 cups", name: "rice" });
    expect(splitIngredientLines(["", "   ", "1 onion"])).toEqual([{ quantity: "1", name: "onion" }]);
  });
});

describe("split quantities stay scalable", () => {
  it("produces quantities that scaleIngredientQuantity actually scales", () => {
    for (const [line, doubled] of [
      ["2 cups cooked rice", "4 cups"],
      ["1/2 tsp salt", "1 tsp"],
      ["1.5 cups milk", "3 cups"],
      ["1½ lb chicken thighs", "3 lb"],
      ["1/3 cup oats", "⅔ cup"],
    ] as const) {
      const { quantity } = splitIngredientLine(line);
      expect(quantity, line).toBeDefined();
      expect(scaleIngredientQuantity(quantity as string, 2), line).toBe(doubled);
    }
  });
});
