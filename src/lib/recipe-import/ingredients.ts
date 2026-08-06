import { formatQuantityAmount, quantityFractions } from "../planning";

/**
 * Splits a written ingredient line into the scalable amount and the food name.
 *
 * The emitted `quantity` is always in the shape `scaleIngredientQuantity` parses — a whole
 * number and/or a unicode fraction first, unit text after — so imported recipes scale with
 * the servings stepper exactly like hand-entered ones.
 */

const units = [
  "cups", "cup", "tablespoons", "tablespoon", "tbsps", "tbsp", "tbs", "teaspoons", "teaspoon", "tsps", "tsp",
  "kilograms", "kilogram", "kg", "grams", "gram", "g", "milligrams", "mg",
  "pounds", "pound", "lbs", "lb", "ounces", "ounce", "oz",
  "milliliters", "millilitres", "ml", "liters", "litres", "liter", "litre", "l",
  "quarts", "quart", "qt", "pints", "pint", "pt", "gallons", "gallon",
  "cloves", "clove", "cans", "can", "jars", "jar", "packets", "packet", "packages", "package", "pkg",
  "slices", "slice", "sticks", "stick", "stalks", "stalk", "sprigs", "sprig", "bunches", "bunch",
  "heads", "head", "pieces", "piece", "pinches", "pinch", "dashes", "dash", "handfuls", "handful",
  "scoops", "scoop", "drops", "drop", "leaves", "leaf", "fillets", "fillet", "ears", "ear",
];
const unitPattern = new RegExp(`^(?:fl\\.?\\s*oz|${units.join("|")})\\.?$`, "i");
const fractionCharacters = Object.keys(quantityFractions).join("");
const decimal = (raw: string) => Number(raw.replace(",", "."));
/**
 * Amount forms, most specific first — ordered alternation matters: "1/2 tsp" must not
 * read as the whole number 1 with a stray "/2" left in the food name.
 */
const amountForms: Array<{ pattern: RegExp; value: (groups: string[]) => number }> = [
  { pattern: new RegExp(`^(\\d+)\\s+(\\d+)\\s*\\/\\s*(\\d+)`), value: ([whole, numerator, denominator]) => Number(whole) + Number(numerator) / Number(denominator) },
  { pattern: new RegExp(`^(\\d+)\\s*\\/\\s*(\\d+)`), value: ([numerator, denominator]) => Number(numerator) / Number(denominator) },
  { pattern: new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*([${fractionCharacters}])`), value: ([whole, fraction]) => decimal(whole) + quantityFractions[fraction] },
  { pattern: new RegExp(`^([${fractionCharacters}])`), value: ([fraction]) => quantityFractions[fraction] },
  { pattern: new RegExp(`^(\\d+(?:[.,]\\d+)?)`), value: ([whole]) => decimal(whole) },
];
/** Ranges and "or" alternatives resolve to the lower bound, which is what the cook can always start from. */
const rangeSeparator = /^\s*(?:-|–|—|to\b|or\b)\s*/i;

export type SplitIngredient = { quantity?: string; name: string };

function readAmount(text: string): { value: number; length: number } | undefined {
  for (const form of amountForms) {
    const match = text.match(form.pattern);
    if (!match) continue;
    const value = form.value(match.slice(1));
    if (!Number.isFinite(value) || value <= 0) return undefined;
    return { value, length: match[0].length };
  }
  return undefined;
}

/** Turns "2 cups cooked rice" into { quantity: "2 cups", name: "cooked rice" }. Lines without an amount keep their whole text as the name. */
export function splitIngredientLine(line: string): SplitIngredient {
  const trimmed = line.replace(/\s+/g, " ").trim();
  if (!trimmed) return { name: "" };

  const amount = readAmount(trimmed);
  if (!amount) return { name: trimmed };

  let rest = trimmed.slice(amount.length);
  const range = rest.match(rangeSeparator);
  if (range) {
    const upper = readAmount(rest.slice(range[0].length));
    if (upper) rest = rest.slice(range[0].length + upper.length);
  }
  rest = rest.trim();

  const [firstWord = "", ...remaining] = rest.split(" ");
  const unit = unitPattern.test(firstWord) ? firstWord.replace(/\.$/, "") : "";
  const name = (unit ? remaining.join(" ") : rest).replace(/^(?:of\s+)/i, "").trim();

  const quantity = `${formatQuantityAmount(amount.value)}${unit ? ` ${unit}` : ""}`;
  // A bare amount with no food left ("3 eggs" splits to unit "" / name "eggs") is fine, but
  // an amount with nothing after it at all is a measurement, not an ingredient — keep the line whole.
  if (!name) return { name: trimmed };
  return { quantity, name };
}

/** Splits a list of written ingredient lines, dropping blanks and section headings. */
export function splitIngredientLines(lines: string[]): SplitIngredient[] {
  return lines
    .map((line) => splitIngredientLine(line))
    .filter((item) => item.name.length > 0 && item.name.length <= 240);
}
