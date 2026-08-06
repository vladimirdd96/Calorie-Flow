import { describe, expect, it } from "vitest";
import { decodeEntities, extractMetaTags, htmlToText, siteNameFromUrl } from "./html";
import { parseMicrodataRecipe } from "./microdata";
import { dietaryTagsFor } from "./dietary";

describe("decodeEntities", () => {
  it("decodes named, numeric, and hex entities", () => {
    expect(decodeEntities("Salt &amp; pepper &frac12; tsp &#8211; done &#x2153;")).toBe("Salt & pepper ½ tsp – done ⅓");
  });

  it("leaves an unknown entity alone", () => {
    expect(decodeEntities("A &notreal; B")).toBe("A &notreal; B");
  });
});

describe("extractMetaTags", () => {
  const html = `<html><head>
    <meta property="og:title" content="Grandma&#39;s stew" />
    <meta property="og:image" content="https://cdn.example/stew.jpg">
    <meta property="og:site_name" content="Family Kitchen">
    <meta name="description" content="A slow stew">
  </head></html>`;

  it("reads the tags the importer credits the source with", () => {
    expect(extractMetaTags(html)).toEqual({ title: "Grandma's stew", imageUrl: "https://cdn.example/stew.jpg", siteName: "Family Kitchen", description: "A slow stew" });
  });

  it("drops an insecure image so nothing mixed-content is ever hotlinked", () => {
    expect(extractMetaTags(`<meta property="og:image" content="http://cdn.example/a.jpg">`).imageUrl).toBeUndefined();
  });
});

describe("siteNameFromUrl", () => {
  it("strips the www prefix", () => {
    expect(siteNameFromUrl("https://www.seriouseats.com/recipe")).toBe("seriouseats.com");
    expect(siteNameFromUrl("not a url")).toBeUndefined();
  });
});

describe("htmlToText", () => {
  it("drops scripts, styles, and chrome while keeping content lines", () => {
    const html = `<html><head><style>.a{color:red}</style></head><body>
      <nav>Home About</nav><script>track()</script>
      <h1>Stew</h1><ul><li>2 cups rice</li><li>1 onion</li></ul>
      <footer>Copyright</footer></body></html>`;
    const text = htmlToText(html);
    expect(text).toContain("Stew");
    expect(text).toContain("2 cups rice");
    expect(text).toContain("1 onion");
    expect(text).not.toContain("track()");
    expect(text).not.toContain("color:red");
    expect(text).not.toContain("Home About");
    expect(text).not.toContain("Copyright");
  });

  it("keeps each list item on its own line", () => {
    expect(htmlToText("<li>2 cups rice</li><li>1 onion</li>").split("\n")).toEqual(["2 cups rice", "1 onion"]);
  });

  it("caps the length", () => {
    expect(htmlToText(`<p>${"word ".repeat(10_000)}</p>`, 500)).toHaveLength(500);
  });
});

describe("parseMicrodataRecipe", () => {
  it("reads an itemprop-marked recipe", () => {
    const html = `<div itemscope itemtype="http://schema.org/Recipe">
      <h1 itemprop="name">Stew</h1>
      <span itemprop="recipeYield">Serves 6</span>
      <li itemprop="recipeIngredient">2 carrots</li>
      <li itemprop="recipeIngredient">1 <b>onion</b></li>
      <p itemprop="recipeInstructions">Simmer everything</p>
    </div>`;
    expect(parseMicrodataRecipe(html)).toMatchObject({
      name: "Stew", servings: 6, ingredients: ["2 carrots", "1 onion"], instructions: ["Simmer everything"],
    });
  });

  it("returns undefined when nothing is marked up", () => {
    expect(parseMicrodataRecipe("<div><p>Just a story about soup</p></div>")).toBeUndefined();
  });
});

describe("dietaryTagsFor", () => {
  it("tags a plant-only recipe vegan", () => {
    expect(dietaryTagsFor(["red lentils", "spinach", "olive oil"])).toContain("vegan");
  });

  it("does not tag a chicken recipe vegetarian", () => {
    expect(dietaryTagsFor(["chicken thighs", "rice"])).not.toContain("vegetarian");
  });

  it("treats fish as pescatarian, not vegetarian", () => {
    const tags = dietaryTagsFor(["salmon fillet", "lemon"]);
    expect(tags).toContain("pescatarian");
    expect(tags).not.toContain("vegetarian");
  });

  it("does not let plant milk count as dairy", () => {
    expect(dietaryTagsFor(["oat milk", "banana"])).toContain("dairyFree");
  });

  it("needs low carbs on top of the ingredient rules for keto", () => {
    const nutrition = { calories: 500, protein: 40, carbs: 6, fat: 35, fiber: 3, sugar: 2 };
    expect(dietaryTagsFor(["chicken thighs", "olive oil"], nutrition)).toContain("keto");
    expect(dietaryTagsFor(["chicken thighs", "rice"], nutrition)).not.toContain("keto");
  });
});
