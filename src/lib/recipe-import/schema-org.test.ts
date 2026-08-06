import { describe, expect, it } from "vitest";
import { extractJsonLdBlocks, findRecipeNode, parseInstructions, parseMeasurement, parseSchemaRecipe, parseServings } from "./schema-org";

const page = (jsonLd: string) => `<html><head><script type="application/ld+json">${jsonLd}</script></head><body></body></html>`;

describe("extractJsonLdBlocks", () => {
  it("skips a malformed block instead of failing the whole import", () => {
    const html = `${page("{ not json ")}${page('{"@type":"Recipe","name":"Soup"}')}`;
    expect(extractJsonLdBlocks(html)).toEqual([{ "@type": "Recipe", name: "Soup" }]);
  });

  it("decodes escaped markup inside the block", () => {
    expect(extractJsonLdBlocks(page('{"@type":"Recipe","name":"Salt &amp; pepper tofu"}'))).toEqual([{ "@type": "Recipe", name: "Salt & pepper tofu" }]);
  });

  it("returns nothing for a page with no structured data", () => {
    expect(extractJsonLdBlocks("<html><body><h1>Grandma's stew</h1></body></html>")).toEqual([]);
  });
});

describe("findRecipeNode", () => {
  it("finds the recipe inside an @graph wrapper", () => {
    const blocks = [{ "@graph": [{ "@type": "WebSite" }, { "@type": "Recipe", name: "Stew" }] }];
    expect(findRecipeNode(blocks)?.name).toBe("Stew");
  });

  it("matches an @type declared as an array", () => {
    expect(findRecipeNode([[{ "@type": ["Article", "Recipe"], name: "Bowl" }]])?.name).toBe("Bowl");
  });

  it("returns undefined when the page has no recipe node", () => {
    expect(findRecipeNode([{ "@type": "BlogPosting", name: "About me" }])).toBeUndefined();
  });
});

describe("parseServings", () => {
  it("reads every recipeYield shape publishers emit", () => {
    expect(parseServings(4)).toBe(4);
    expect(parseServings("4 servings")).toBe(4);
    expect(parseServings(["4", "4 servings"])).toBe(4);
    expect(parseServings("serves a crowd")).toBeUndefined();
    expect(parseServings(0)).toBeUndefined();
  });
});

describe("parseMeasurement", () => {
  it("reads the leading number out of a schema.org measurement", () => {
    expect(parseMeasurement("320 kcal")).toBe(320);
    expect(parseMeasurement("12 g")).toBe(12);
    expect(parseMeasurement("1,5 g")).toBe(1.5);
    expect(parseMeasurement("trace")).toBeUndefined();
  });
});

describe("parseInstructions", () => {
  it("flattens HowToStep objects", () => {
    expect(parseInstructions([{ "@type": "HowToStep", text: "Chop the onion" }, { "@type": "HowToStep", text: "Fry it" }]))
      .toEqual(["Chop the onion", "Fry it"]);
  });

  it("recurses into HowToSection itemListElement", () => {
    const sections = [{ "@type": "HowToSection", name: "Sauce", itemListElement: [{ "@type": "HowToStep", text: "Simmer tomatoes" }] }];
    expect(parseInstructions(sections)).toEqual(["Simmer tomatoes"]);
  });

  it("splits a single HTML string into steps", () => {
    expect(parseInstructions("<p>Boil water</p><p>Add pasta</p>")).toEqual(["Boil water", "Add pasta"]);
  });
});

describe("parseSchemaRecipe", () => {
  const node = {
    "@type": "Recipe",
    name: "Lentil bowl",
    recipeYield: ["4 servings"],
    recipeIngredient: ["2 cups red lentils", "1 tsp cumin"],
    recipeInstructions: [{ "@type": "HowToStep", text: "Simmer the lentils" }],
    image: [{ "@type": "ImageObject", url: "http://insecure.example/a.jpg" }, "https://cdn.example/lentils.jpg"],
    recipeCuisine: "Indian",
    author: { "@type": "Person", name: "Priya" },
    nutrition: { "@type": "NutritionInformation", calories: "420 calories", proteinContent: "25 g", carbohydrateContent: "55 g", fatContent: "12 g", servingSize: "350 g" },
  };

  it("maps a full recipe node", () => {
    expect(parseSchemaRecipe(node)).toEqual({
      name: "Lentil bowl",
      servings: 4,
      ingredients: ["2 cups red lentils", "1 tsp cumin"],
      instructions: ["Simmer the lentils"],
      imageUrl: "https://cdn.example/lentils.jpg",
      cuisine: "Indian",
      author: "Priya",
      description: undefined,
      nutrition: { calories: 420, protein: 25, carbs: 55, fat: 12, fiber: undefined, sugar: undefined },
      servingGrams: 350,
    });
  });

  it("takes the first https image and never an http one", () => {
    expect(parseSchemaRecipe({ ...node, image: "http://insecure.example/a.jpg" })?.imageUrl).toBeUndefined();
  });

  it("accepts the legacy `ingredients` key", () => {
    const legacy = { "@type": "Recipe", ingredients: ["1 onion"], recipeInstructions: "Chop it" };
    expect(parseSchemaRecipe(legacy)?.ingredients).toEqual(["1 onion"]);
  });

  it("returns undefined when a node has neither ingredients nor instructions", () => {
    expect(parseSchemaRecipe({ "@type": "Recipe", name: "Empty" })).toBeUndefined();
    expect(parseSchemaRecipe(undefined)).toBeUndefined();
  });
});
