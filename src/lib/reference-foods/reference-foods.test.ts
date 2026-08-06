import { describe, expect, it } from "vitest";
import { foodSchema } from "../schemas";
import { seedFoods } from "../seed";
import { foodMatchesQuery } from "../food-search";
import { referenceFoods } from ".";

const byName = (name: string) => referenceFoods.find((food) => food.name === name);

describe("reference foods", () => {
  it("covers the dishes and drinks online product search cannot answer", () => {
    expect(referenceFoods.length).toBeGreaterThan(300);
    expect(referenceFoods.map((food) => food.name)).toEqual(expect.arrayContaining([
      "Shopska salad", "Snezhanka salad", "Tarator", "Banitsa", "Kebapche", "Lyutenitsa", "Sirene",
      "Greek salad", "Cevapi", "Margherita pizza", "Wiener schnitzel", "Fish and chips",
      "Mojito", "Aperol spritz", "Rakia", "Lager beer", "Red wine",
      "Walnuts", "Sour cherries", "Lentils, cooked",
    ]));
  });

  it("gives every row a unique id, a serving and validated nutrition", () => {
    expect(new Set(referenceFoods.map((food) => food.id)).size).toBe(referenceFoods.length);
    referenceFoods.forEach((food) => {
      expect(foodSchema.safeParse(food).success, `${food.name} must satisfy the food schema`).toBe(true);
      expect(food.source).toBe("seed");
      expect(food.servingGrams, `${food.name} needs a serving size`).toBeGreaterThan(0);
      expect(food.keywords?.length, `${food.name} needs search keywords`).toBeGreaterThan(0);
      const { calories, protein, carbs, fat } = food.nutrientsPer100;
      expect(calories, `${food.name} calories`).toBeLessThanOrEqual(900);
      // Macros must fit in 100 g, with room for water, alcohol, ash and rounding.
      expect(protein + carbs + fat, `${food.name} macros per 100 g`).toBeLessThanOrEqual(100);
    });
  });

  it("keeps prepared dishes and mixed drinks flagged as estimates", () => {
    expect(byName("Shopska salad")?.verified).toBeUndefined();
    expect(byName("Mojito")?.verified).toBeUndefined();
    expect(byName("Sirene")?.verified).toBe(true);
    expect(byName("Walnuts")?.verified).toBe(true);
  });

  it("is reachable by Bulgarian and Cyrillic search terms", () => {
    const find = (query: string) => referenceFoods.filter((food) => foodMatchesQuery(food, query.toLocaleLowerCase())).map((food) => food.name);
    expect(find("шопска")).toContain("Shopska salad");
    expect(find("баница")).toContain("Banitsa");
    expect(find("ракия")).toContain("Rakia");
    expect(find("мохито")).toContain("Mojito");
    expect(find("кисело мляко")).toContain("Bulgarian yoghurt 3.6%");
    expect(find("дюнер")).toContain("Dyuner");
    expect(find("орехи")).toContain("Walnuts");
    expect(find("shopska salata")).toContain("Shopska salad");
  });

  it("merges into the seeded catalogue without colliding with existing foods", () => {
    expect(new Set(seedFoods.map((food) => food.id)).size).toBe(seedFoods.length);
    referenceFoods.forEach((food) => expect(seedFoods.some((seed) => seed.id === food.id)).toBe(true));
  });
});
