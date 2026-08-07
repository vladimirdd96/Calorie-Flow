/**
 * GTIN handling for barcode lookup.
 *
 * Two failure modes make a scan miss or, worse, return the wrong product:
 *
 * 1. The same package is filed under different GTIN lengths in different databases.
 *    A US product scanned as UPC-A (12 digits) is stored by Open Food Facts as the
 *    zero-padded EAN-13, and Nutritionix stores the unpadded UPC. Querying only the
 *    digits the scanner produced misses the other spelling of the same number.
 * 2. A single-frame misread can produce digits that look plausible. Every GTIN carries
 *    a check digit, so a misread is cheap to detect before it becomes a wrong answer.
 */

/** Lengths the GS1 standard defines: GTIN-8, GTIN-12 (UPC-A), GTIN-13 (EAN-13), GTIN-14. */
const gtinLengths = [8, 12, 13, 14] as const;

export function normalizeGtin(value: string) {
  return value.replace(/\D/g, "");
}

/**
 * Validates the trailing check digit. Positions are weighted 3 and 1 alternately from
 * the right, which is the same rule at every GTIN length.
 */
export function isValidGtin(value: string) {
  const digits = normalizeGtin(value);
  if (!gtinLengths.includes(digits.length as (typeof gtinLengths)[number])) return false;
  let sum = 0;
  for (let index = 0; index < digits.length - 1; index += 1) {
    // The digit adjacent to the check digit always carries weight 3.
    const weight = (digits.length - index) % 2 === 0 ? 3 : 1;
    sum += Number(digits[index]) * weight;
  }
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}

/** Zero-padded 14-digit form, the one representation every valid GTIN shares. */
export function toGtin14(value: string) {
  const digits = normalizeGtin(value);
  return digits.length > 14 ? "" : digits.padStart(14, "0");
}

/**
 * Every equivalent spelling of the same GTIN, scanned form first so the most likely
 * storage format is tried before the padded and stripped alternatives.
 */
export function gtinVariants(value: string): string[] {
  const scanned = normalizeGtin(value);
  const canonical = toGtin14(scanned);
  if (!canonical) return scanned ? [scanned] : [];
  const significant = canonical.replace(/^0+/, "").length;
  const variants = gtinLengths
    .filter((length) => length >= significant)
    .map((length) => canonical.slice(14 - length));
  return [...new Set([scanned, ...variants])].filter(Boolean);
}

/**
 * GS1 reserves prefix 02 and the 20-29 range for restricted circulation: codes a shop
 * or manufacturer assigns for its own use. Lidl and Kaufland label a lot of fresh and
 * own-brand stock this way, so these scan fine but are only unique inside one retail
 * chain — the same digits can name a different product in another country. Worth
 * looking up, never worth trusting as a global identity.
 */
export function isRestrictedCirculationGtin(value: string) {
  // The prefix only means anything at the code's own length, so zero padding has to be
  // undone first: "00000020961800" and "20961800" are the same EAN-8, and only the
  // second spelling shows the 20 that marks it restricted.
  const shortest = gtinVariants(value).reduce<string | undefined>((best, variant) => {
    if (!gtinLengths.includes(variant.length as (typeof gtinLengths)[number])) return best;
    return !best || variant.length < best.length ? variant : best;
  }, undefined);
  if (!shortest) return false;
  // UPC-A has no room for a two-digit prefix: 2 is in-store, 4 is company-internal.
  if (shortest.length === 12) return shortest[0] === "2" || shortest[0] === "4";
  const prefix = shortest.slice(0, 2);
  return prefix === "02" || (prefix >= "20" && prefix <= "29");
}
