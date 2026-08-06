import { tagTextToLine } from "./html";
import type { ParsedRecipe } from "./schema-org";

/**
 * Best-effort microdata/RDFa sweep for older recipe pages that predate JSON-LD.
 * Only consulted when JSON-LD yielded nothing; a partial result still beats sending
 * the whole page to the model.
 */

function itemPropValues(html: string, property: string): string[] {
  const pattern = new RegExp(`<([a-z0-9]+)[^>]*itemprop=["'][^"']*\\b${property}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`, "gi");
  const values: string[] = [];
  for (const match of html.matchAll(pattern)) {
    const line = tagTextToLine(match[2]);
    if (line && line.length <= 500 && !values.includes(line)) values.push(line);
  }
  return values;
}

function itemPropAttribute(html: string, property: string, attribute: string): string | undefined {
  const pattern = new RegExp(`<[a-z0-9]+[^>]*itemprop=["'][^"']*\\b${property}\\b[^"']*["'][^>]*>`, "i");
  const tag = html.match(pattern)?.[0];
  return tag?.match(new RegExp(`${attribute}=["']([^"']+)["']`, "i"))?.[1];
}

export function parseMicrodataRecipe(html: string): ParsedRecipe | undefined {
  const ingredients = [...itemPropValues(html, "recipeIngredient"), ...itemPropValues(html, "ingredients")];
  const instructions = itemPropValues(html, "recipeInstructions");
  if (!ingredients.length && !instructions.length) return undefined;
  const image = itemPropAttribute(html, "image", "src") || itemPropAttribute(html, "image", "content");
  const yieldText = itemPropValues(html, "recipeYield")[0];
  const servings = yieldText?.match(/\d+/)?.[0];
  return {
    name: itemPropValues(html, "name")[0],
    servings: servings ? Number(servings) : undefined,
    ingredients,
    instructions,
    imageUrl: image && /^https:\/\//i.test(image) ? image : undefined,
    cuisine: itemPropValues(html, "recipeCuisine")[0],
  };
}
